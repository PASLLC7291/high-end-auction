import { db } from "@/lib/turso";

export type UserPreferences = {
    user_id: string;
    email_notifications: boolean;
    bid_alerts: boolean;
    marketing_emails: boolean;
    created_at: string;
    updated_at: string;
};

function rowToPrefs(row: Record<string, unknown>): UserPreferences {
    return {
        user_id: row.user_id as string,
        email_notifications: Boolean(row.email_notifications),
        bid_alerts: Boolean(row.bid_alerts),
        marketing_emails: Boolean(row.marketing_emails),
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
    };
}

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
    const result = await db.execute({
        sql: "SELECT * FROM user_preferences WHERE user_id = ?",
        args: [userId],
    });

    if (result.rows.length > 0) {
        return rowToPrefs(result.rows[0] as unknown as Record<string, unknown>);
    }

    const now = new Date().toISOString();
    await db.execute({
        sql: `INSERT INTO user_preferences (
                user_id, email_notifications, bid_alerts, marketing_emails, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [userId, 1, 1, 0, now, now],
    });

    const inserted = await db.execute({
        sql: "SELECT * FROM user_preferences WHERE user_id = ?",
        args: [userId],
    });
    if (inserted.rows.length === 0) {
        throw new Error("Failed to initialize user preferences");
    }
    return rowToPrefs(inserted.rows[0] as unknown as Record<string, unknown>);
}

export async function updateUserPreferences(userId: string, input: Partial<Pick<UserPreferences, "email_notifications" | "bid_alerts" | "marketing_emails">>): Promise<UserPreferences> {
    const existing = await getUserPreferences(userId);
    const now = new Date().toISOString();

    const nextEmailNotifications = input.email_notifications ?? existing.email_notifications;
    const nextBidAlerts = input.bid_alerts ?? existing.bid_alerts;
    const nextMarketingEmails = input.marketing_emails ?? existing.marketing_emails;

    await db.execute({
        sql: `UPDATE user_preferences
              SET email_notifications = ?, bid_alerts = ?, marketing_emails = ?, updated_at = ?
              WHERE user_id = ?`,
        args: [
            nextEmailNotifications ? 1 : 0,
            nextBidAlerts ? 1 : 0,
            nextMarketingEmails ? 1 : 0,
            now,
            userId,
        ],
    });

    return await getUserPreferences(userId);
}
