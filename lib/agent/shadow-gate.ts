/**
 * Shadow Gate — Controls which tools have side effects and provides
 * simulated responses when running in shadow mode.
 *
 * Shadow mode lets agents run against real read-only data while
 * preventing any writes, orders, payments, or notifications.
 */

import type { ToolResult } from "./types";

// ---------------------------------------------------------------------------
// Side-Effect Tools
// ---------------------------------------------------------------------------

/**
 * Complete set of tool names that have side effects (mutations, orders,
 * payments, alerts, emails). Read-only tools are NOT in this set.
 */
const SIDE_EFFECT_TOOLS: Set<string> = new Set([
  "pipeline_poll_closed_sales",
  "pipeline_retry_fulfillments",
  "pipeline_process_refunds",
  "pipeline_handle_stuck_lots",
  "pipeline_auto_source",
  "pipeline_smart_source",
  "lot_update",
  "keyword_add",
  "cj_create_order",
  "cj_pay_order",
  "alert_send",
  "email_send",
]);

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Check if a tool has side effects.
 */
export function isSideEffect(toolName: string): boolean {
  return SIDE_EFFECT_TOOLS.has(toolName);
}

/**
 * Return a simulated success result for a side-effect tool in shadow mode.
 */
export function shadowResult(
  toolName: string,
  args: Record<string, unknown>
): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: `[SHADOW] Would execute ${toolName} with args: ${JSON.stringify(args)}. Simulated success.`,
      },
    ],
    isError: false,
  };
}
