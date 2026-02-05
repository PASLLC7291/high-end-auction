import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/turso";

export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    try {
        // Execute deletes atomically to avoid partial cleanup on failure.
        await db.batch(
            [
                { sql: "DELETE FROM watchlist_items WHERE user_id = ?", args: [userId] },
                { sql: "DELETE FROM user_preferences WHERE user_id = ?", args: [userId] },
                { sql: "DELETE FROM user_profiles WHERE user_id = ?", args: [userId] },
                { sql: "DELETE FROM payment_profiles WHERE user_id = ?", args: [userId] },
                {
                    sql: `DELETE FROM payment_order_items
                          WHERE basta_order_id IN (SELECT basta_order_id FROM payment_orders WHERE user_id = ?)`,
                    args: [userId],
                },
                { sql: "DELETE FROM payment_orders WHERE user_id = ?", args: [userId] },
                { sql: "DELETE FROM balance_promotion_redemptions WHERE user_id = ?", args: [userId] },
                { sql: "DELETE FROM users WHERE id = ?", args: [userId] },
            ],
            "write"
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete account error:", error);
        return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }
}
