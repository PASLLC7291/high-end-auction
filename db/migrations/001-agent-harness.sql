-- Agent Harness Migration: Tables for agent runs, decisions, and circuit breakers.
-- All CREATE TABLE IF NOT EXISTS for idempotency.

-- ---------------------------------------------------------------------------
-- Agent Runs — one row per agent invocation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  trigger_detail TEXT NOT NULL DEFAULT '',
  shadow_mode INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  total_turns INTEGER DEFAULT 0,
  total_tool_calls INTEGER DEFAULT 0,
  summary TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id ON agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON agent_runs(created_at);

-- ---------------------------------------------------------------------------
-- Agent Decisions — one row per tool call or reasoning step
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_decisions (
  id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  tool_name TEXT,
  tool_args TEXT,
  tool_result TEXT,
  reasoning TEXT,
  shadow_mode INTEGER NOT NULL DEFAULT 0,
  circuit_breaker_tripped TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  trigger_detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_correlation_id ON agent_decisions(correlation_id);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_agent_id ON agent_decisions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_tool_name ON agent_decisions(tool_name);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_created_at ON agent_decisions(created_at);

-- ---------------------------------------------------------------------------
-- Circuit Breaker State — one row per breaker
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  breaker_name TEXT PRIMARY KEY,
  current_value REAL NOT NULL DEFAULT 0,
  last_reset_at TEXT,
  tripped INTEGER NOT NULL DEFAULT 0,
  tripped_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
