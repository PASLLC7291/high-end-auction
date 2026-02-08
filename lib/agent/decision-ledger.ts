/**
 * Decision Ledger — Records agent runs and individual decisions to the database.
 *
 * Every tool call, reasoning step, and circuit breaker trip is logged here
 * for auditability and replay.
 */

import { db, generateId } from "@/lib/turso";
import type { AgentId, DecisionLedgerEntry } from "./types";

// ---------------------------------------------------------------------------
// Agent Runs
// ---------------------------------------------------------------------------

/**
 * Start a new agent run. Returns the correlation ID for the run.
 */
export async function startRun(params: {
  agentId: AgentId;
  triggerType: "scheduled" | "manual" | "reactive";
  triggerDetail: string;
  shadowMode: boolean;
}): Promise<string> {
  const id = generateId();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO agent_runs (id, agent_id, trigger_type, trigger_detail, shadow_mode, status, started_at, created_at)
          VALUES (?, ?, ?, ?, ?, 'running', ?, ?)`,
    args: [
      id,
      params.agentId,
      params.triggerType,
      params.triggerDetail,
      params.shadowMode ? 1 : 0,
      now,
      now,
    ],
  });

  return id;
}

/**
 * Complete an agent run with final status and summary.
 */
export async function completeRun(params: {
  correlationId: string;
  status: "completed" | "failed" | "aborted";
  totalTurns: number;
  totalToolCalls: number;
  summary: string;
  error?: string;
}): Promise<void> {
  const now = new Date().toISOString();

  await db.execute({
    sql: `UPDATE agent_runs
          SET status = ?, completed_at = ?, total_turns = ?, total_tool_calls = ?, summary = ?, error = ?
          WHERE id = ?`,
    args: [
      params.status,
      now,
      params.totalTurns,
      params.totalToolCalls,
      params.summary,
      params.error ?? null,
      params.correlationId,
    ],
  });
}

// ---------------------------------------------------------------------------
// Agent Decisions
// ---------------------------------------------------------------------------

/** Max chars for tool_result JSON to prevent DB bloat. */
const MAX_RESULT_LENGTH = 10000;

/**
 * Log a single agent decision (tool call or reasoning step).
 */
export async function logDecision(entry: DecisionLedgerEntry): Promise<void> {
  const id = generateId();

  let toolResultStr: string | null = null;
  if (entry.toolResult != null) {
    const raw = JSON.stringify(entry.toolResult);
    toolResultStr =
      raw.length > MAX_RESULT_LENGTH
        ? raw.slice(0, MAX_RESULT_LENGTH) + "...(truncated)"
        : raw;
  }

  await db.execute({
    sql: `INSERT INTO agent_decisions
            (id, correlation_id, agent_id, turn_number, tool_name, tool_args,
             tool_result, reasoning, shadow_mode, circuit_breaker_tripped,
             duration_ms, trigger_type, trigger_detail, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      entry.correlationId,
      entry.agentId,
      entry.turnNumber,
      entry.toolName ?? null,
      entry.toolArgs ? JSON.stringify(entry.toolArgs) : null,
      toolResultStr,
      entry.reasoning,
      entry.shadowMode ? 1 : 0,
      entry.circuitBreakerTripped ?? null,
      entry.durationMs,
      entry.triggerType,
      entry.triggerDetail,
      new Date().toISOString(),
    ],
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

type AgentRunRow = {
  id: string;
  agent_id: string;
  trigger_type: string;
  trigger_detail: string;
  shadow_mode: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_turns: number;
  total_tool_calls: number;
  summary: string | null;
  error: string | null;
  created_at: string;
};

type AgentDecisionRow = {
  id: string;
  correlation_id: string;
  agent_id: string;
  turn_number: number;
  tool_name: string | null;
  tool_args: string | null;
  tool_result: string | null;
  reasoning: string | null;
  shadow_mode: number;
  circuit_breaker_tripped: string | null;
  duration_ms: number;
  trigger_type: string;
  trigger_detail: string;
  created_at: string;
};

/**
 * Get recent agent runs, optionally filtered by agent ID.
 */
export async function getRecentRuns(params?: {
  agentId?: AgentId;
  limit?: number;
}): Promise<AgentRunRow[]> {
  const limit = params?.limit ?? 10;

  if (params?.agentId) {
    const result = await db.execute({
      sql: `SELECT * FROM agent_runs WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?`,
      args: [params.agentId, limit],
    });
    return result.rows as unknown as AgentRunRow[];
  }

  const result = await db.execute({
    sql: `SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT ?`,
    args: [limit],
  });
  return result.rows as unknown as AgentRunRow[];
}

/**
 * Get all decisions for a specific run.
 */
export async function getDecisionsForRun(
  correlationId: string
): Promise<AgentDecisionRow[]> {
  const result = await db.execute({
    sql: `SELECT * FROM agent_decisions WHERE correlation_id = ? ORDER BY turn_number, created_at`,
    args: [correlationId],
  });
  return result.rows as unknown as AgentDecisionRow[];
}

/**
 * Get a single run by ID.
 */
export async function getRunById(id: string): Promise<AgentRunRow | null> {
  const result = await db.execute({
    sql: `SELECT * FROM agent_runs WHERE id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as AgentRunRow;
}
