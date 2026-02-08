/**
 * Lot Status State Machine — validates status transitions for dropship lots.
 *
 * Every status transition the agent attempts is checked against this map
 * to prevent invalid state changes (e.g. jumping from SOURCED to DELIVERED).
 */

import type { DropshipLotStatus } from "@/lib/dropship";

// ---------------------------------------------------------------------------
// Valid Transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<DropshipLotStatus, DropshipLotStatus[]> = {
  SOURCED: ["LISTED", "CANCELLED"],
  LISTED: ["PUBLISHED", "CANCELLED"],
  PUBLISHED: ["AUCTION_CLOSED", "RESERVE_NOT_MET", "CANCELLED"],
  AUCTION_CLOSED: ["PAID", "PAYMENT_FAILED", "CANCELLED"],
  PAID: ["CJ_ORDERED", "CJ_OUT_OF_STOCK", "CJ_PRICE_CHANGED", "CANCELLED"],
  CJ_ORDERED: ["CJ_PAID", "CANCELLED"],
  CJ_PAID: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  RESERVE_NOT_MET: [],
  PAYMENT_FAILED: ["CANCELLED"],
  CJ_OUT_OF_STOCK: ["CANCELLED"],
  CJ_PRICE_CHANGED: ["CANCELLED"],
  CANCELLED: [],
};

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Check if a transition from one status to another is valid.
 */
export function validateTransition(
  from: DropshipLotStatus,
  to: DropshipLotStatus
): boolean {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Get all terminal statuses (no valid outgoing transitions).
 */
export function getTerminalStatuses(): DropshipLotStatus[] {
  return (Object.entries(VALID_TRANSITIONS) as [DropshipLotStatus, DropshipLotStatus[]][])
    .filter(([, targets]) => targets.length === 0)
    .map(([status]) => status);
}

/**
 * Get the valid next statuses for a given status.
 */
export function getValidNextStatuses(
  from: DropshipLotStatus
): DropshipLotStatus[] {
  return VALID_TRANSITIONS[from] ?? [];
}
