/**
 * Dropship Lots — DB operations for CJ ↔ Basta ↔ Fulfillment mapping
 */

import { db, generateId } from "@/lib/turso";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DropshipLot = {
  id: string;
  cj_pid: string;
  cj_vid: string;
  cj_product_name: string;
  cj_variant_name: string | null;
  cj_cost_cents: number;
  cj_shipping_cents: number;
  cj_logistic_name: string | null;
  cj_from_country: string;
  cj_images: string | null;
  basta_sale_id: string | null;
  basta_item_id: string | null;
  starting_bid_cents: number;
  reserve_cents: number;
  winner_user_id: string | null;
  winning_bid_cents: number | null;
  basta_order_id: string | null;
  stripe_invoice_id: string | null;
  cj_order_id: string | null;
  cj_order_number: string | null;
  cj_order_status: string | null;
  cj_paid_at: string | null;
  shipping_name: string | null;
  shipping_address: string | null;
  tracking_number: string | null;
  tracking_carrier: string | null;
  total_cost_cents: number | null;
  profit_cents: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type DropshipLotStatus =
  | "SOURCED"
  | "LISTED"
  | "PUBLISHED"
  | "AUCTION_CLOSED"
  | "PAID"
  | "CJ_ORDERED"
  | "CJ_PAID"
  | "SHIPPED"
  | "DELIVERED"
  | "RESERVE_NOT_MET"
  | "PAYMENT_FAILED"
  | "CJ_OUT_OF_STOCK"
  | "CJ_PRICE_CHANGED"
  | "CANCELLED";

// ---------------------------------------------------------------------------
// State Machine — valid status transitions
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
  PAYMENT_FAILED: ["PAID", "CANCELLED"],
  CJ_OUT_OF_STOCK: ["CANCELLED"],
  CJ_PRICE_CHANGED: ["CANCELLED"],
  CANCELLED: [],
};

export function validateTransition(
  from: DropshipLotStatus,
  to: DropshipLotStatus,
): boolean {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

// ---------------------------------------------------------------------------
// Insert
// ---------------------------------------------------------------------------

export async function insertDropshipLot(lot: {
  cj_pid: string;
  cj_vid: string;
  cj_product_name: string;
  cj_variant_name?: string;
  cj_cost_cents: number;
  cj_shipping_cents: number;
  cj_logistic_name?: string;
  cj_from_country?: string;
  cj_images?: string[];
  starting_bid_cents: number;
  reserve_cents: number;
}): Promise<string> {
  const id = generateId();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO dropship_lots (
      id, cj_pid, cj_vid, cj_product_name, cj_variant_name,
      cj_cost_cents, cj_shipping_cents, cj_logistic_name, cj_from_country, cj_images,
      starting_bid_cents, reserve_cents, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SOURCED', ?, ?)`,
    args: [
      id,
      lot.cj_pid,
      lot.cj_vid,
      lot.cj_product_name,
      lot.cj_variant_name ?? null,
      lot.cj_cost_cents,
      lot.cj_shipping_cents,
      lot.cj_logistic_name ?? null,
      lot.cj_from_country ?? "CN",
      lot.cj_images ? JSON.stringify(lot.cj_images) : null,
      lot.starting_bid_cents,
      lot.reserve_cents,
      now,
      now,
    ],
  });

  return id;
}

// ---------------------------------------------------------------------------
// Update helpers
// ---------------------------------------------------------------------------

export async function updateDropshipLot(
  id: string,
  updates: Partial<
    Pick<
      DropshipLot,
      | "basta_sale_id"
      | "basta_item_id"
      | "winner_user_id"
      | "winning_bid_cents"
      | "basta_order_id"
      | "stripe_invoice_id"
      | "cj_order_id"
      | "cj_order_number"
      | "cj_order_status"
      | "cj_paid_at"
      | "shipping_name"
      | "shipping_address"
      | "tracking_number"
      | "tracking_carrier"
      | "total_cost_cents"
      | "profit_cents"
      | "status"
      | "error_message"
    >
  >
): Promise<void> {
  // Validate status transition if status is being changed
  if (updates.status) {
    const currentLot = await getDropshipLotById(id);
    if (currentLot && !validateTransition(currentLot.status as DropshipLotStatus, updates.status as DropshipLotStatus)) {
      throw new Error(`Invalid status transition: ${currentLot.status} → ${updates.status}`);
    }
  }

  const setClauses: string[] = ["updated_at = ?"];
  const args: (string | number | null)[] = [new Date().toISOString()];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setClauses.push(`${key} = ?`);
      args.push(value as string | number | null);
    }
  }

  args.push(id);

  await db.execute({
    sql: `UPDATE dropship_lots SET ${setClauses.join(", ")} WHERE id = ?`,
    args,
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

function rowToLot(row: Record<string, unknown>): DropshipLot {
  return {
    id: row.id as string,
    cj_pid: row.cj_pid as string,
    cj_vid: row.cj_vid as string,
    cj_product_name: row.cj_product_name as string,
    cj_variant_name: row.cj_variant_name as string | null,
    cj_cost_cents: row.cj_cost_cents as number,
    cj_shipping_cents: row.cj_shipping_cents as number,
    cj_logistic_name: row.cj_logistic_name as string | null,
    cj_from_country: (row.cj_from_country as string) ?? "CN",
    cj_images: row.cj_images as string | null,
    basta_sale_id: row.basta_sale_id as string | null,
    basta_item_id: row.basta_item_id as string | null,
    starting_bid_cents: row.starting_bid_cents as number,
    reserve_cents: row.reserve_cents as number,
    winner_user_id: row.winner_user_id as string | null,
    winning_bid_cents: row.winning_bid_cents as number | null,
    basta_order_id: row.basta_order_id as string | null,
    stripe_invoice_id: row.stripe_invoice_id as string | null,
    cj_order_id: row.cj_order_id as string | null,
    cj_order_number: row.cj_order_number as string | null,
    cj_order_status: row.cj_order_status as string | null,
    cj_paid_at: row.cj_paid_at as string | null,
    shipping_name: row.shipping_name as string | null,
    shipping_address: row.shipping_address as string | null,
    tracking_number: row.tracking_number as string | null,
    tracking_carrier: row.tracking_carrier as string | null,
    total_cost_cents: row.total_cost_cents as number | null,
    profit_cents: row.profit_cents as number | null,
    status: row.status as string,
    error_message: row.error_message as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getDropshipLotByBastaItem(
  bastaItemId: string
): Promise<DropshipLot | null> {
  const result = await db.execute({
    sql: "SELECT * FROM dropship_lots WHERE basta_item_id = ?",
    args: [bastaItemId],
  });

  if (result.rows.length === 0) return null;
  return rowToLot(result.rows[0] as unknown as Record<string, unknown>);
}

export async function getDropshipLotsBySale(
  bastaSaleId: string
): Promise<DropshipLot[]> {
  const result = await db.execute({
    sql: "SELECT * FROM dropship_lots WHERE basta_sale_id = ?",
    args: [bastaSaleId],
  });

  return result.rows.map((row) =>
    rowToLot(row as unknown as Record<string, unknown>)
  );
}

export async function getDropshipLotsByStatus(
  status: DropshipLotStatus
): Promise<DropshipLot[]> {
  const result = await db.execute({
    sql: "SELECT * FROM dropship_lots WHERE status = ? ORDER BY created_at ASC",
    args: [status],
  });

  return result.rows.map((row) =>
    rowToLot(row as unknown as Record<string, unknown>)
  );
}

export async function getDropshipLotById(
  id: string
): Promise<DropshipLot | null> {
  const result = await db.execute({
    sql: "SELECT * FROM dropship_lots WHERE id = ?",
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return rowToLot(result.rows[0] as unknown as Record<string, unknown>);
}

export async function getDropshipLotByCjOrder(
  cjOrderId: string
): Promise<DropshipLot | null> {
  const result = await db.execute({
    sql: "SELECT * FROM dropship_lots WHERE cj_order_id = ?",
    args: [cjOrderId],
  });

  if (result.rows.length === 0) return null;
  return rowToLot(result.rows[0] as unknown as Record<string, unknown>);
}

export async function getAllDropshipLots(): Promise<DropshipLot[]> {
  const result = await db.execute(
    "SELECT * FROM dropship_lots ORDER BY created_at DESC"
  );

  return result.rows.map((row) =>
    rowToLot(row as unknown as Record<string, unknown>)
  );
}

// ---------------------------------------------------------------------------
// Buyer / Support lookup queries
// ---------------------------------------------------------------------------

/** Get all lots won by a specific user, newest first. */
export async function getDropshipLotsByWinner(
  winnerUserId: string
): Promise<DropshipLot[]> {
  const result = await db.execute({
    sql: "SELECT * FROM dropship_lots WHERE winner_user_id = ? ORDER BY created_at DESC",
    args: [winnerUserId],
  });

  return result.rows.map((row) =>
    rowToLot(row as unknown as Record<string, unknown>)
  );
}

/** Get a lot by its Stripe invoice ID (for support lookups). */
export async function getDropshipLotByStripeInvoice(
  invoiceId: string
): Promise<DropshipLot | null> {
  const result = await db.execute({
    sql: "SELECT * FROM dropship_lots WHERE stripe_invoice_id = ?",
    args: [invoiceId],
  });

  if (result.rows.length === 0) return null;
  return rowToLot(result.rows[0] as unknown as Record<string, unknown>);
}

/** Get lots with active tracking (shipped but not delivered). */
export async function getDropshipLotsInTransit(): Promise<DropshipLot[]> {
  const result = await db.execute(
    "SELECT * FROM dropship_lots WHERE status IN ('SHIPPED', 'CJ_PAID', 'CJ_ORDERED') ORDER BY updated_at ASC"
  );

  return result.rows.map((row) =>
    rowToLot(row as unknown as Record<string, unknown>)
  );
}

/** Count lots grouped by status (lightweight dashboard query). */
export async function getDropshipLotStatusCounts(): Promise<
  Record<string, number>
> {
  const result = await db.execute(
    "SELECT status, COUNT(*) as count FROM dropship_lots GROUP BY status"
  );

  const counts: Record<string, number> = {};
  for (const row of result.rows) {
    const r = row as unknown as Record<string, unknown>;
    counts[r.status as string] = Number(r.count);
  }
  return counts;
}
