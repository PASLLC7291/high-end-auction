import { db, generateId } from "@/lib/turso";

export type WatchlistItem = {
    id: string;
    user_id: string;
    sale_id: string;
    item_id: string;
    created_at: string;
};

export async function listWatchlistItems(userId: string): Promise<WatchlistItem[]> {
    const result = await db.execute({
        sql: "SELECT * FROM watchlist_items WHERE user_id = ? ORDER BY created_at DESC",
        args: [userId],
    });

    return result.rows.map((row) => ({
        id: row.id as string,
        user_id: row.user_id as string,
        sale_id: row.sale_id as string,
        item_id: row.item_id as string,
        created_at: row.created_at as string,
    }));
}

export async function addWatchlistItem(params: {
    userId: string;
    saleId: string;
    itemId: string;
}): Promise<WatchlistItem> {
    const now = new Date().toISOString();
    const id = generateId();

    await db.execute({
        sql: `INSERT INTO watchlist_items (id, user_id, sale_id, item_id, created_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(user_id, sale_id, item_id) DO UPDATE SET created_at = excluded.created_at`,
        args: [id, params.userId, params.saleId, params.itemId, now],
    });

    const row = await db.execute({
        sql: "SELECT * FROM watchlist_items WHERE user_id = ? AND sale_id = ? AND item_id = ?",
        args: [params.userId, params.saleId, params.itemId],
    });

    if (row.rows.length === 0) {
        throw new Error("Failed to add watchlist item");
    }

    const item = row.rows[0];
    return {
        id: item.id as string,
        user_id: item.user_id as string,
        sale_id: item.sale_id as string,
        item_id: item.item_id as string,
        created_at: item.created_at as string,
    };
}

export async function removeWatchlistItem(params: {
    userId: string;
    saleId: string;
    itemId: string;
}): Promise<void> {
    await db.execute({
        sql: "DELETE FROM watchlist_items WHERE user_id = ? AND sale_id = ? AND item_id = ?",
        args: [params.userId, params.saleId, params.itemId],
    });
}

export async function isWatchlisted(params: {
    userId: string;
    saleId: string;
    itemId: string;
}): Promise<boolean> {
    const result = await db.execute({
        sql: "SELECT 1 FROM watchlist_items WHERE user_id = ? AND sale_id = ? AND item_id = ?",
        args: [params.userId, params.saleId, params.itemId],
    });
    return result.rows.length > 0;
}

export async function countWatchlistItems(userId: string): Promise<number> {
    const result = await db.execute({
        sql: "SELECT COUNT(*) as count FROM watchlist_items WHERE user_id = ?",
        args: [userId],
    });
    const row = result.rows[0] as { count?: number };
    return Number(row?.count ?? 0);
}

