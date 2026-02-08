/**
 * Tool Dispatcher — Routes tool calls to handlers with safety layers.
 *
 * Before executing any tool:
 * 1. Shadow gate: block side-effect tools in shadow mode
 * 2. Circuit breakers: check spending/rate/margin limits
 * 3. Zod validation: parse args against schema
 * 4. Execute handler
 * 5. On success: reset consecutive failure counter
 * 6. On failure: increment consecutive failure counter
 */

import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { isSideEffect, shadowResult } from "./shadow-gate";
import {
  checkCircuitBreakers,
  incrementBreaker,
  resetConsecutiveFailures,
} from "./circuit-breakers";
import type { CircuitBreakerConfig } from "./types";
import { DEFAULT_CIRCUIT_BREAKERS } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolDispatcher = {
  dispatch: (
    toolName: string,
    args: Record<string, unknown>,
    shadowMode: boolean
  ) => Promise<{
    result: ToolResult;
    circuitBreakerTripped: string | null;
    durationMs: number;
  }>;
  getToolNames: () => string[];
};

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build a tool dispatcher from a list of tool definitions.
 *
 * The dispatcher applies shadow gate, circuit breakers, and Zod validation
 * before routing to the handler.
 */
export function buildToolDispatcher(
  tools: ToolDefinition[],
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKERS
): ToolDispatcher {
  const handlerMap = new Map<string, { handler: ToolHandler; schema: ToolDefinition["schema"] }>();

  for (const tool of tools) {
    handlerMap.set(tool.name, { handler: tool.handler, schema: tool.schema });
  }

  return {
    getToolNames: () => Array.from(handlerMap.keys()),

    dispatch: async (toolName, args, shadowMode) => {
      const startMs = Date.now();
      let circuitBreakerTripped: string | null = null;

      const entry = handlerMap.get(toolName);
      if (!entry) {
        return {
          result: {
            content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
            isError: true,
          },
          circuitBreakerTripped: null,
          durationMs: Date.now() - startMs,
        };
      }

      // ── Shadow Gate ──────────────────────────────────────────────
      if (shadowMode && isSideEffect(toolName)) {
        return {
          result: shadowResult(toolName, args),
          circuitBreakerTripped: null,
          durationMs: Date.now() - startMs,
        };
      }

      // ── Circuit Breakers ─────────────────────────────────────────
      if (!shadowMode && isSideEffect(toolName)) {
        const check = await checkCircuitBreakers(toolName, args, config);
        if (!check.ok) {
          circuitBreakerTripped = check.breaker;
          return {
            result: {
              content: [
                {
                  type: "text",
                  text: `Circuit breaker tripped: ${check.breaker}. ${check.message}`,
                },
              ],
              isError: true,
            },
            circuitBreakerTripped,
            durationMs: Date.now() - startMs,
          };
        }
      }

      // ── Execute ──────────────────────────────────────────────────
      try {
        // Parse args through Zod schema for validation
        const parsed = entry.schema.parse(args);
        const result = await entry.handler(parsed as Record<string, unknown>);

        // On success: reset consecutive failures
        if (!result.isError) {
          await resetConsecutiveFailures();

          // Post-execution breaker increments for side-effect tools
          if (!shadowMode && isSideEffect(toolName)) {
            await postExecutionIncrements(toolName, args, config);
          }
        } else {
          // Tool returned an error — increment consecutive failures
          await incrementBreaker(
            "consecutive_failures",
            1,
            config.maxConsecutiveFailures
          );
        }

        return {
          result,
          circuitBreakerTripped,
          durationMs: Date.now() - startMs,
        };
      } catch (error) {
        // Increment consecutive failures on exception
        await incrementBreaker(
          "consecutive_failures",
          1,
          config.maxConsecutiveFailures
        );

        const message =
          error instanceof Error ? error.message : String(error);

        return {
          result: {
            content: [
              {
                type: "text",
                text: `Tool execution error: ${message}`,
              },
            ],
            isError: true,
          },
          circuitBreakerTripped,
          durationMs: Date.now() - startMs,
        };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Post-execution breaker increments
// ---------------------------------------------------------------------------

async function postExecutionIncrements(
  toolName: string,
  args: Record<string, unknown>,
  config: CircuitBreakerConfig
): Promise<void> {
  if (toolName === "cj_pay_order") {
    // Increment spending counter (estimate — exact amount unknown at this layer)
    // We increment by 1 as a call counter; the actual $ amount is tracked differently
    await incrementBreaker(
      "max_cj_orders_per_hour",
      1,
      config.maxCjOrdersPerHour
    );
  }

  if (
    toolName === "pipeline_auto_source" ||
    toolName === "pipeline_smart_source"
  ) {
    await incrementBreaker(
      "daily_lot_creation_cap",
      1,
      config.dailyLotCreationCap
    );
  }

  if (toolName === "pipeline_process_refunds") {
    await incrementBreaker("max_refunds_per_day", 1, config.maxRefundsPerDay);
  }
}
