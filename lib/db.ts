import { db, generateId } from "@/lib/turso";

// Webhook Events
export async function isWebhookProcessed(provider: string, idempotencyKey: string): Promise<boolean> {
    const result = await db.execute({
        sql: "SELECT id FROM webhook_events WHERE provider = ? AND idempotency_key = ?",
        args: [provider, idempotencyKey],
    });
    return result.rows.length > 0;
}

export async function markWebhookProcessed(
    provider: string,
    idempotencyKey: string,
    payload: unknown
): Promise<boolean> {
    try {
        const now = new Date().toISOString();
        const result = await db.execute({
            sql: `INSERT OR IGNORE INTO webhook_events (id, provider, idempotency_key, payload, created_at)
                  VALUES (?, ?, ?, ?, ?)`,
            args: [generateId(), provider, idempotencyKey, JSON.stringify(payload), now],
        });
        // rowsAffected === 0 means the row already existed (IGNORE fired)
        return (result.rowsAffected ?? 0) > 0;
    } catch {
        return false;
    }
}

// Payment Orders
export type PaymentOrder = {
    id: string;
    basta_order_id: string;
    sale_id: string;
    user_id: string;
    stripe_invoice_id: string | null;
    stripe_invoice_url: string | null;
    status: string | null;
    created_at: string;
    updated_at: string;
};

export async function getPaymentOrderBySaleAndUser(
    saleId: string,
    userId: string
): Promise<PaymentOrder | null> {
    const result = await db.execute({
        sql: "SELECT * FROM payment_orders WHERE sale_id = ? AND user_id = ?",
        args: [saleId, userId],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
        id: row.id as string,
        basta_order_id: row.basta_order_id as string,
        sale_id: row.sale_id as string,
        user_id: row.user_id as string,
        stripe_invoice_id: row.stripe_invoice_id as string | null,
        stripe_invoice_url: row.stripe_invoice_url as string | null,
        status: row.status as string | null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
    };
}

export async function getPaymentOrderByInvoiceId(invoiceId: string): Promise<PaymentOrder | null> {
    const result = await db.execute({
        sql: "SELECT * FROM payment_orders WHERE stripe_invoice_id = ?",
        args: [invoiceId],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
        id: row.id as string,
        basta_order_id: row.basta_order_id as string,
        sale_id: row.sale_id as string,
        user_id: row.user_id as string,
        stripe_invoice_id: row.stripe_invoice_id as string | null,
        stripe_invoice_url: row.stripe_invoice_url as string | null,
        status: row.status as string | null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
    };
}

export async function insertPaymentOrder(order: {
    basta_order_id: string;
    sale_id: string;
    user_id: string;
    status: string;
}): Promise<void> {
    const now = new Date().toISOString();
    await db.execute({
        sql: `INSERT INTO payment_orders (id, basta_order_id, sale_id, user_id, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [generateId(), order.basta_order_id, order.sale_id, order.user_id, order.status, now, now],
    });
}

export async function listPaymentOrdersByUser(userId: string): Promise<PaymentOrder[]> {
    const result = await db.execute({
        sql: "SELECT * FROM payment_orders WHERE user_id = ? ORDER BY created_at DESC",
        args: [userId],
    });

    return result.rows.map((row) => ({
        id: row.id as string,
        basta_order_id: row.basta_order_id as string,
        sale_id: row.sale_id as string,
        user_id: row.user_id as string,
        stripe_invoice_id: row.stripe_invoice_id as string | null,
        stripe_invoice_url: row.stripe_invoice_url as string | null,
        status: row.status as string | null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
    }));
}

export async function updatePaymentOrder(
    bastaOrderId: string,
    updates: Partial<Pick<PaymentOrder, "stripe_invoice_id" | "stripe_invoice_url" | "status">>
): Promise<void> {
    const setClauses: string[] = ["updated_at = ?"];
    const args: (string | null)[] = [new Date().toISOString()];

    if (updates.stripe_invoice_id !== undefined) {
        setClauses.push("stripe_invoice_id = ?");
        args.push(updates.stripe_invoice_id);
    }
    if (updates.stripe_invoice_url !== undefined) {
        setClauses.push("stripe_invoice_url = ?");
        args.push(updates.stripe_invoice_url);
    }
    if (updates.status !== undefined) {
        setClauses.push("status = ?");
        args.push(updates.status);
    }

    args.push(bastaOrderId);

    await db.execute({
        sql: `UPDATE payment_orders SET ${setClauses.join(", ")} WHERE basta_order_id = ?`,
        args,
    });
}

export async function updatePaymentOrderByInvoiceId(
    invoiceId: string,
    updates: Partial<Pick<PaymentOrder, "status">>
): Promise<void> {
    const now = new Date().toISOString();
    await db.execute({
        sql: "UPDATE payment_orders SET status = ?, updated_at = ? WHERE stripe_invoice_id = ?",
        args: [updates.status ?? null, now, invoiceId],
    });
}

// Payment Order Items
export async function getProcessedItemIds(): Promise<Set<string>> {
    const result = await db.execute("SELECT item_id FROM payment_order_items");
    return new Set(result.rows.map((row) => row.item_id as string));
}

export async function upsertPaymentOrderItem(bastaOrderId: string, itemId: string): Promise<void> {
    const now = new Date().toISOString();
    await db.execute({
        sql: `INSERT INTO payment_order_items (id, basta_order_id, item_id, created_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(item_id) DO UPDATE SET basta_order_id = excluded.basta_order_id`,
        args: [generateId(), bastaOrderId, itemId, now],
    });
}

export async function listPaymentOrderItemIds(bastaOrderId: string): Promise<string[]> {
    const result = await db.execute({
        sql: "SELECT item_id FROM payment_order_items WHERE basta_order_id = ? ORDER BY created_at DESC",
        args: [bastaOrderId],
    });
    return result.rows.map((row) => row.item_id as string);
}

export async function countPaymentOrderItemsByUser(userId: string): Promise<number> {
    const result = await db.execute({
        sql: `SELECT COUNT(*) as count
              FROM payment_order_items i
              JOIN payment_orders o ON o.basta_order_id = i.basta_order_id
              WHERE o.user_id = ?`,
        args: [userId],
    });
    const row = result.rows[0] as { count?: number };
    return Number(row?.count ?? 0);
}
