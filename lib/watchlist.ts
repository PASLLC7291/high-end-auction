import { db } from "@/lib/turso";

/** Count how many watchlist items a user has. */
export async function countWatchlistItems(userId: string): Promise<number> {
  const result = await db.execute({
    sql: "SELECT COUNT(*) as count FROM watchlist_items WHERE user_id = ?",
    args: [userId],
  });

  const row = result.rows[0] as unknown as Record<string, unknown>;
  return Number(row.count ?? 0);
}
