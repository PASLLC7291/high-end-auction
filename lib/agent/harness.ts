/**
 * Agent Harness — Main agent execution loop.
 *
 * Wraps the Anthropic SDK to run Claude as an autonomous agent with:
 * - Tool calling via the tool dispatcher (with shadow gate + circuit breakers)
 * - Decision logging to the database
 * - Turn counting and max_turns enforcement
 * - Error handling for API and tool failures
 * - Global shadow mode check
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  AgentConfig,
  AgentContext,
  AgentRunResult,
  DecisionLedgerEntry,
  AgentId,
} from "./types";
import { startRun, completeRun, logDecision } from "./decision-ledger";
import { getToolsByNames, getToolDefinitions } from "./mcp";
import { buildToolDispatcher } from "./tool-dispatch";
import { getBreakerState } from "./circuit-breakers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RunOptions = {
  agentConfig: AgentConfig;
  initialMessage: string;
  triggerType: "scheduled" | "manual" | "reactive";
  triggerDetail: string;
  shadowModeOverride?: boolean;
};

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

// ---------------------------------------------------------------------------
// Main Agent Loop
// ---------------------------------------------------------------------------

/**
 * Run an agent with the given configuration and initial message.
 *
 * The agent loop:
 * 1. Sends the initial message to Claude with tools
 * 2. Processes tool_use responses by dispatching through the tool dispatcher
 * 3. Feeds tool results back to Claude
 * 4. Repeats until Claude stops calling tools or maxTurns is reached
 * 5. Logs everything to the decision ledger
 */
export async function runAgent(options: RunOptions): Promise<AgentRunResult> {
  const { agentConfig, initialMessage, triggerType, triggerDetail } = options;

  // Determine shadow mode
  let shadowMode = options.shadowModeOverride ?? agentConfig.defaultShadowMode;

  // Check global shadow mode flag
  try {
    const globalShadow = await getBreakerState("global_shadow_mode");
    if (globalShadow.tripped) {
      shadowMode = true;
    }
  } catch {
    // If breaker state is unavailable, continue with configured mode
  }

  // Initialize Anthropic client
  const anthropic = new Anthropic();

  // Start run in ledger
  const correlationId = await startRun({
    agentId: agentConfig.agentId,
    triggerType,
    triggerDetail,
    shadowMode,
  });

  const context: AgentContext = {
    correlationId,
    triggerType,
    triggerDetail,
    startedAt: new Date(),
    turnCount: 0,
    shadowMode,
  };

  // Set up tools
  const tools = getToolsByNames(agentConfig.toolNames);
  const toolDefs = getToolDefinitions(tools);
  const dispatcher = buildToolDispatcher(tools);

  // Build messages array
  const messages: AnthropicMessage[] = [
    { role: "user", content: initialMessage },
  ];

  const decisions: DecisionLedgerEntry[] = [];
  let totalToolCalls = 0;
  let lastAssistantText = "";
  let runError: string | undefined;

  try {
    // Agent loop
    for (let turn = 0; turn < agentConfig.maxTurns; turn++) {
      context.turnCount = turn + 1;

      // Call Anthropic API
      const response = await anthropic.messages.create({
        model: agentConfig.model,
        system: buildSystemPrompt(agentConfig, context),
        messages: messages as Anthropic.MessageParam[],
        tools: toolDefs as Anthropic.Tool[],
        max_tokens: 4096,
      });

      // Process response content blocks
      const assistantContent: AnthropicContentBlock[] = [];
      let currentReasoning = "";
      const toolUseBlocks: Array<{
        id: string;
        name: string;
        input: Record<string, unknown>;
      }> = [];

      for (const block of response.content) {
        if (block.type === "text") {
          currentReasoning += block.text;
          assistantContent.push({ type: "text", text: block.text });
        } else if (block.type === "tool_use") {
          toolUseBlocks.push({
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          });
          assistantContent.push({
            type: "tool_use",
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          });
        }
      }

      lastAssistantText = currentReasoning;

      // Add assistant message to history
      messages.push({ role: "assistant", content: assistantContent });

      // If no tool calls, the agent is done
      if (toolUseBlocks.length === 0) {
        // Log final reasoning
        if (currentReasoning) {
          const entry: DecisionLedgerEntry = {
            correlationId,
            agentId: agentConfig.agentId,
            turnNumber: context.turnCount,
            toolName: null,
            toolArgs: null,
            toolResult: null,
            reasoning: currentReasoning,
            shadowMode,
            circuitBreakerTripped: null,
            durationMs: 0,
            triggerType,
            triggerDetail,
          };
          decisions.push(entry);
          await logDecision(entry);
        }
        break;
      }

      // Process tool calls
      const toolResults: AnthropicContentBlock[] = [];

      for (const toolUse of toolUseBlocks) {
        const startMs = Date.now();
        totalToolCalls++;

        const {
          result: toolResult,
          circuitBreakerTripped,
          durationMs,
        } = await dispatcher.dispatch(toolUse.name, toolUse.input, shadowMode);

        // Log decision
        const entry: DecisionLedgerEntry = {
          correlationId,
          agentId: agentConfig.agentId,
          turnNumber: context.turnCount,
          toolName: toolUse.name,
          toolArgs: toolUse.input,
          toolResult: toolResult.content.map((c) => c.text).join("\n"),
          reasoning: currentReasoning,
          shadowMode,
          circuitBreakerTripped,
          durationMs,
          triggerType,
          triggerDetail,
        };
        decisions.push(entry);
        await logDecision(entry);

        // Clear reasoning after first tool call in this turn (it was logged)
        currentReasoning = "";

        // Build tool_result message
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: toolResult.content.map((c) => c.text).join("\n"),
          is_error: toolResult.isError,
        });
      }

      // Add tool results as user message
      messages.push({ role: "user", content: toolResults });

      // Check if we've hit the last turn
      if (turn === agentConfig.maxTurns - 2) {
        // Add a nudge for the final turn
        messages.push({
          role: "user",
          content:
            "Maximum turns approaching. Please provide a summary of what you accomplished and any outstanding items.",
        });
      }
    }
  } catch (error) {
    runError =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);

    console.error(
      `[harness] Agent ${agentConfig.agentId} failed:`,
      runError
    );
  }

  // Determine status
  const status: AgentRunResult["status"] = runError
    ? "failed"
    : context.turnCount >= agentConfig.maxTurns
      ? "aborted"
      : "completed";

  // Build summary from last assistant text
  const summary =
    lastAssistantText.slice(0, 2000) ||
    (runError ? `Agent failed: ${runError}` : "Agent completed without output.");

  // Complete run in ledger
  await completeRun({
    correlationId,
    status,
    totalTurns: context.turnCount,
    totalToolCalls,
    summary,
    error: runError,
  });

  return {
    correlationId,
    agentId: agentConfig.agentId,
    status,
    totalTurns: context.turnCount,
    totalToolCalls,
    summary,
    decisions,
    error: runError,
  };
}

// ---------------------------------------------------------------------------
// System Prompt Builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  config: AgentConfig,
  context: AgentContext
): string {
  const modeLabel = context.shadowMode ? "[SHADOW MODE]" : "[LIVE MODE]";
  const turnInfo = `Turn ${context.turnCount}/${config.maxTurns}`;

  return `${config.systemPrompt}

---
Runtime Context:
- Mode: ${modeLabel}
- ${turnInfo}
- Correlation ID: ${context.correlationId}
- Trigger: ${context.triggerType} (${context.triggerDetail})
- Started: ${context.startedAt.toISOString()}
${context.shadowMode ? "\nIMPORTANT: You are in SHADOW MODE. All side-effect tools will return simulated results. Read-only tools work normally. This is safe for testing and analysis." : ""}`;
}
