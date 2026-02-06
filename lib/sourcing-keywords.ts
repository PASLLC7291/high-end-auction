/**
 * Sourcing Keywords — DB operations for scheduled auto-sourcing keyword rotation.
 */

import { db, generateId } from "@/lib/turso";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SourcingKeyword = {
  id: string;
  keyword: string;
  max_cost_usd: number;
  max_products: number;
  priority: number;
  active: number; // 0 or 1 (SQLite boolean)
  last_sourced_at: string | null;
  total_runs: number;
  total_lots_created: number;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToKeyword(row: Record<string, unknown>): SourcingKeyword {
  return {
    id: row.id as string,
    keyword: row.keyword as string,
    max_cost_usd: row.max_cost_usd as number,
    max_products: row.max_products as number,
    priority: row.priority as number,
    active: row.active as number,
    last_sourced_at: row.last_sourced_at as string | null,
    total_runs: row.total_runs as number,
    total_lots_created: row.total_lots_created as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Returns the active keyword with the oldest last_sourced_at (or never sourced first),
 * highest priority first.
 */
export async function getNextKeyword(): Promise<SourcingKeyword | null> {
  const result = await db.execute(
    `SELECT * FROM sourcing_keywords
     WHERE active = 1
     ORDER BY
       last_sourced_at IS NOT NULL ASC,
       last_sourced_at ASC,
       priority DESC,
       created_at ASC
     LIMIT 1`
  );

  if (result.rows.length === 0) return null;
  return rowToKeyword(result.rows[0] as unknown as Record<string, unknown>);
}

/**
 * Update last_sourced_at, increment total_runs and total_lots_created.
 */
export async function markKeywordSourced(
  id: string,
  lotsCreated: number
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE sourcing_keywords
          SET last_sourced_at = ?,
              total_runs = total_runs + 1,
              total_lots_created = total_lots_created + ?,
              updated_at = ?
          WHERE id = ?`,
    args: [now, lotsCreated, now, id],
  });
}

/**
 * Insert a new sourcing keyword.
 */
export async function insertKeyword(params: {
  keyword: string;
  maxCostUsd?: number;
  maxProducts?: number;
  priority?: number;
}): Promise<string> {
  const id = generateId();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO sourcing_keywords
            (id, keyword, max_cost_usd, max_products, priority, active,
             total_runs, total_lots_created, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, 0, 0, ?, ?)`,
    args: [
      id,
      params.keyword,
      params.maxCostUsd ?? 50,
      params.maxProducts ?? 5,
      params.priority ?? 0,
      now,
      now,
    ],
  });

  return id;
}

/**
 * List all sourcing keywords (active and inactive), ordered by priority desc.
 */
export async function listKeywords(): Promise<SourcingKeyword[]> {
  const result = await db.execute(
    "SELECT * FROM sourcing_keywords ORDER BY active DESC, priority DESC, created_at ASC"
  );

  return result.rows.map((row) =>
    rowToKeyword(row as unknown as Record<string, unknown>)
  );
}

/**
 * Toggle a keyword active/inactive.
 */
export async function toggleKeyword(
  id: string,
  active: boolean
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE sourcing_keywords SET active = ?, updated_at = ? WHERE id = ?`,
    args: [active ? 1 : 0, now, id],
  });
}

/**
 * Delete a sourcing keyword by id.
 */
export async function deleteKeyword(id: string): Promise<void> {
  await db.execute({
    sql: `DELETE FROM sourcing_keywords WHERE id = ?`,
    args: [id],
  });
}
