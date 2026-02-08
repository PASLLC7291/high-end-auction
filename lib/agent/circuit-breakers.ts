/**
 * Circuit Breakers — Spending, rate, and margin safety limits for agent operations.
 *
 * Each breaker tracks a counter in the database. When a threshold is exceeded,
 * the breaker trips and blocks further side-effect tool calls until reset.
 *
 * Breakers auto-reset daily (checked on read). Manual reset via CLI.
 */

import { db } from "@/lib/turso";
import { getFinancialSummary } from "@/lib/pipeline";
import { isSideEffect } from "./shadow-gate";
import { DEFAULT_CIRCUIT_BREAKERS, type CircuitBreakerConfig } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BreakerState = {
  breakerName: string;
  currentValue: number;
  lastResetAt: string | null;
  tripped: boolean;
  trippedAt: string | null;
  updatedAt: string;
};

type BreakerCheckResult =
  | { ok: true }
  | { ok: false; breaker: string; message: string };

// ---------------------------------------------------------------------------
// Breaker names
// ---------------------------------------------------------------------------

const BREAKER_NAMES = [
  "daily_spending_cap",
  "daily_lot_creation_cap",
  "margin_floor",
  "consecutive_failures",
  "max_cj_orders_per_hour",
  "max_refunds_per_day",
  "global_shadow_mode",
] as const;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Insert default rows for each breaker if they don't exist.
 */
export async function initBreakerState(): Promise<void> {
  const now = new Date().toISOString();

  for (const name of BREAKER_NAMES) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO circuit_breaker_state (breaker_name, current_value, last_reset_at, tripped, updated_at)
            VALUES (?, 0, ?, 0, ?)`,
      args: [name, now, now],
    });
  }
}

// ---------------------------------------------------------------------------
// State Management
// ---------------------------------------------------------------------------

/**
 * Get the current state of a breaker, auto-resetting daily counters if needed.
 */
export async function getBreakerState(
  breakerName: string
): Promise<BreakerState> {
  // Ensure the row exists
  await db.execute({
    sql: `INSERT OR IGNORE INTO circuit_breaker_state (breaker_name, current_value, last_reset_at, tripped, updated_at)
          VALUES (?, 0, ?, 0, ?)`,
    args: [breakerName, new Date().toISOString(), new Date().toISOString()],
  });

  const result = await db.execute({
    sql: `SELECT * FROM circuit_breaker_state WHERE breaker_name = ?`,
    args: [breakerName],
  });

  const row = result.rows[0] as unknown as Record<string, unknown>;

  const state: BreakerState = {
    breakerName: row.breaker_name as string,
    currentValue: row.current_value as number,
    lastResetAt: row.last_reset_at as string | null,
    tripped: (row.tripped as number) === 1,
    trippedAt: row.tripped_at as string | null,
    updatedAt: row.updated_at as string,
  };

  // Auto-reset daily counters if last_reset_at is before today's midnight UTC
  if (breakerName !== "global_shadow_mode" && state.lastResetAt) {
    const lastReset = new Date(state.lastResetAt);
    const todayMidnight = new Date();
    todayMidnight.setUTCHours(0, 0, 0, 0);

    if (lastReset < todayMidnight) {
      await resetBreaker(breakerName);
      state.currentValue = 0;
      state.tripped = false;
      state.trippedAt = null;
      state.lastResetAt = new Date().toISOString();
    }
  }

  return state;
}

/**
 * Trip a breaker immediately.
 */
export async function tripBreaker(breakerName: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE circuit_breaker_state SET tripped = 1, tripped_at = ?, updated_at = ? WHERE breaker_name = ?`,
    args: [now, now, breakerName],
  });
}

/**
 * Reset a breaker: clear counter and un-trip it.
 */
export async function resetBreaker(breakerName: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE circuit_breaker_state SET tripped = 0, current_value = 0, last_reset_at = ?, updated_at = ? WHERE breaker_name = ?`,
    args: [now, now, breakerName],
  });
}

/**
 * Increment a breaker's counter and trip if it exceeds the threshold.
 */
export async function incrementBreaker(
  breakerName: string,
  amount: number,
  threshold: number
): Promise<{ tripped: boolean; newValue: number }> {
  const state = await getBreakerState(breakerName);
  const newValue = state.currentValue + amount;
  const now = new Date().toISOString();

  await db.execute({
    sql: `UPDATE circuit_breaker_state SET current_value = ?, updated_at = ? WHERE breaker_name = ?`,
    args: [newValue, now, breakerName],
  });

  if (newValue >= threshold && !state.tripped) {
    await tripBreaker(breakerName);
    return { tripped: true, newValue };
  }

  return { tripped: state.tripped, newValue };
}

/**
 * Reset the consecutive_failures breaker to 0 (called on successful tool execution).
 */
export async function resetConsecutiveFailures(): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE circuit_breaker_state SET current_value = 0, tripped = 0, updated_at = ? WHERE breaker_name = 'consecutive_failures'`,
    args: [now],
  });
}

// ---------------------------------------------------------------------------
// Margin Floor Cache
// ---------------------------------------------------------------------------

let marginCache: { value: number; fetchedAt: number } | null = null;
const MARGIN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCachedMargin(): Promise<number> {
  if (marginCache && Date.now() - marginCache.fetchedAt < MARGIN_CACHE_TTL_MS) {
    return marginCache.value;
  }

  try {
    const summary = await getFinancialSummary();
    marginCache = { value: summary.profitMargin, fetchedAt: Date.now() };
    return summary.profitMargin;
  } catch {
    // If we can't get margin data, assume it's ok
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Main Check Function
// ---------------------------------------------------------------------------

/**
 * Check all relevant circuit breakers before executing a tool.
 * Returns ok:true if the tool can proceed, or ok:false with the tripped breaker info.
 */
export async function checkCircuitBreakers(
  toolName: string,
  args: Record<string, unknown>,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKERS
): Promise<BreakerCheckResult> {
  // Only check breakers for side-effect tools
  if (!isSideEffect(toolName)) {
    return { ok: true };
  }

  // Check consecutive failures breaker
  const failureState = await getBreakerState("consecutive_failures");
  if (failureState.tripped) {
    return {
      ok: false,
      breaker: "consecutive_failures",
      message: `Too many consecutive failures (${failureState.currentValue}/${config.maxConsecutiveFailures}). Agent should stop and alert.`,
    };
  }

  // Tool-specific breaker checks
  if (toolName === "cj_pay_order") {
    // Check daily spending cap
    const spendingState = await getBreakerState("daily_spending_cap");
    if (spendingState.tripped) {
      return {
        ok: false,
        breaker: "daily_spending_cap",
        message: `Daily spending cap reached ($${(spendingState.currentValue / 100).toFixed(2)}/$${(config.dailySpendingCapCents / 100).toFixed(2)}). No more CJ payments today.`,
      };
    }

    // Check max CJ orders per hour
    const orderState = await getBreakerState("max_cj_orders_per_hour");
    if (orderState.tripped) {
      return {
        ok: false,
        breaker: "max_cj_orders_per_hour",
        message: `CJ order rate limit reached (${orderState.currentValue}/${config.maxCjOrdersPerHour} per hour). Slow down.`,
      };
    }
  }

  if (toolName === "pipeline_auto_source" || toolName === "pipeline_smart_source") {
    // Check daily spending cap
    const spendingState = await getBreakerState("daily_spending_cap");
    if (spendingState.tripped) {
      return {
        ok: false,
        breaker: "daily_spending_cap",
        message: `Daily spending cap reached. No more sourcing today.`,
      };
    }

    // Check daily lot creation cap
    const lotState = await getBreakerState("daily_lot_creation_cap");
    if (lotState.tripped) {
      return {
        ok: false,
        breaker: "daily_lot_creation_cap",
        message: `Daily lot creation cap reached (${lotState.currentValue}/${config.dailyLotCreationCap}). No more sourcing today.`,
      };
    }
  }

  if (toolName === "pipeline_process_refunds") {
    const refundState = await getBreakerState("max_refunds_per_day");
    if (refundState.tripped) {
      return {
        ok: false,
        breaker: "max_refunds_per_day",
        message: `Daily refund cap reached (${refundState.currentValue}/${config.maxRefundsPerDay}). No more refunds today.`,
      };
    }
  }

  // Check margin floor for all side-effect tools
  const margin = await getCachedMargin();
  if (margin < config.marginFloorPercent) {
    const marginState = await getBreakerState("margin_floor");
    if (!marginState.tripped) {
      await tripBreaker("margin_floor");
    }
    return {
      ok: false,
      breaker: "margin_floor",
      message: `Profit margin (${margin.toFixed(1)}%) is below floor (${config.marginFloorPercent}%). Side-effect operations blocked until margin recovers.`,
    };
  }

  return { ok: true };
}

/**
 * Get all breaker states (for CLI display).
 */
export async function getAllBreakerStates(): Promise<BreakerState[]> {
  const result = await db.execute(
    `SELECT * FROM circuit_breaker_state ORDER BY breaker_name`
  );

  return result.rows.map((row) => {
    const r = row as unknown as Record<string, unknown>;
    return {
      breakerName: r.breaker_name as string,
      currentValue: r.current_value as number,
      lastResetAt: r.last_reset_at as string | null,
      tripped: (r.tripped as number) === 1,
      trippedAt: r.tripped_at as string | null,
      updatedAt: r.updated_at as string,
    };
  });
}
