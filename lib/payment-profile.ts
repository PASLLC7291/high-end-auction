import { db } from "@/lib/turso";

export type PaymentProfile = {
    user_id: string;
    stripe_customer_id: string;
    default_payment_method_id: string | null;
    billing_name: string | null;
    billing_line1: string | null;
    billing_line2: string | null;
    billing_city: string | null;
    billing_state: string | null;
    billing_postal_code: string | null;
    billing_country: string | null;
};

export async function getPaymentProfile(userId: string): Promise<PaymentProfile | null> {
    if (!userId) return null;

    try {
        const result = await db.execute({
            sql: "SELECT * FROM payment_profiles WHERE user_id = ?",
            args: [userId],
        });

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            user_id: row.user_id as string,
            stripe_customer_id: row.stripe_customer_id as string,
            default_payment_method_id: row.default_payment_method_id as string | null,
            billing_name: row.billing_name as string | null,
            billing_line1: row.billing_line1 as string | null,
            billing_line2: row.billing_line2 as string | null,
            billing_city: row.billing_city as string | null,
            billing_state: row.billing_state as string | null,
            billing_postal_code: row.billing_postal_code as string | null,
            billing_country: row.billing_country as string | null,
        };
    } catch (error) {
        console.error("Failed to fetch payment profile:", error);
        return null;
    }
}

export async function hasPaymentMethod(userId: string): Promise<boolean> {
    const profile = await getPaymentProfile(userId);
    return Boolean(profile?.default_payment_method_id);
}

export async function upsertPaymentProfile(profile: PaymentProfile): Promise<PaymentProfile | null> {
    const now = new Date().toISOString();

    try {
        await db.execute({
            sql: `INSERT INTO payment_profiles (
                    user_id, stripe_customer_id, default_payment_method_id,
                    billing_name, billing_line1, billing_line2,
                    billing_city, billing_state, billing_postal_code, billing_country,
                    created_at, updated_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(user_id) DO UPDATE SET
                    stripe_customer_id = excluded.stripe_customer_id,
                    default_payment_method_id = excluded.default_payment_method_id,
                    billing_name = excluded.billing_name,
                    billing_line1 = excluded.billing_line1,
                    billing_line2 = excluded.billing_line2,
                    billing_city = excluded.billing_city,
                    billing_state = excluded.billing_state,
                    billing_postal_code = excluded.billing_postal_code,
                    billing_country = excluded.billing_country,
                    updated_at = excluded.updated_at`,
            args: [
                profile.user_id,
                profile.stripe_customer_id,
                profile.default_payment_method_id,
                profile.billing_name,
                profile.billing_line1,
                profile.billing_line2,
                profile.billing_city,
                profile.billing_state,
                profile.billing_postal_code,
                profile.billing_country,
                now,
                now,
            ],
        });

        return await getPaymentProfile(profile.user_id);
    } catch (error) {
        console.error("Failed to upsert payment profile:", error);
        throw error;
    }
}
