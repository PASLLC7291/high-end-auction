import { db } from "@/lib/turso";

export type UserProfile = {
    user_id: string;
    phone: string | null;
    location: string | null;
    created_at: string;
    updated_at: string;
};

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    if (!userId) return null;

    const result = await db.execute({
        sql: "SELECT * FROM user_profiles WHERE user_id = ?",
        args: [userId],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
        user_id: row.user_id as string,
        phone: (row.phone as string | null) ?? null,
        location: (row.location as string | null) ?? null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
    };
}

export async function upsertUserProfile(input: {
    user_id: string;
    phone?: string | null;
    location?: string | null;
}): Promise<UserProfile> {
    const now = new Date().toISOString();

    await db.execute({
        sql: `INSERT INTO user_profiles (user_id, phone, location, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(user_id) DO UPDATE SET
                phone = excluded.phone,
                location = excluded.location,
                updated_at = excluded.updated_at`,
        args: [input.user_id, input.phone ?? null, input.location ?? null, now, now],
    });

    const profile = await getUserProfile(input.user_id);
    if (!profile) {
        throw new Error("Failed to upsert user profile");
    }
    return profile;
}

