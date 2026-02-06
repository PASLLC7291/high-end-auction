import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local for local/dev usage.
// Deployment platforms (Vercel/Netlify) provide env vars directly.
config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

import { createClient } from "@libsql/client";

type TableSpec = {
    columns: string[];
};

const expectedTables: Record<string, TableSpec> = {
    users: {
        columns: ["id", "email", "password_hash", "name", "created_at", "updated_at"],
    },
    payment_profiles: {
        columns: [
            "user_id",
            "stripe_customer_id",
            "default_payment_method_id",
            "billing_name",
            "billing_line1",
            "billing_line2",
            "billing_city",
            "billing_state",
            "billing_postal_code",
            "billing_country",
            "created_at",
            "updated_at",
        ],
    },
    payment_orders: {
        columns: [
            "id",
            "basta_order_id",
            "sale_id",
            "user_id",
            "stripe_invoice_id",
            "stripe_invoice_url",
            "status",
            "created_at",
            "updated_at",
        ],
    },
    payment_order_items: {
        columns: ["id", "basta_order_id", "item_id", "created_at"],
    },
    webhook_events: {
        columns: ["id", "provider", "idempotency_key", "payload", "created_at"],
    },
    user_profiles: {
        columns: ["user_id", "phone", "location", "created_at", "updated_at"],
    },
    user_preferences: {
        columns: [
            "user_id",
            "email_notifications",
            "bid_alerts",
            "marketing_emails",
            "created_at",
            "updated_at",
        ],
    },
    watchlist_items: {
        columns: ["id", "user_id", "sale_id", "item_id", "created_at"],
    },
    lead_submissions: {
        columns: ["id", "type", "email", "payload", "created_at"],
    },
    lead_uploads: {
        columns: ["id", "submission_id", "original_name", "mime_type", "size", "path", "created_at"],
    },
    lead_upload_files: {
        columns: ["id", "data", "sha256", "created_at"],
    },
    balance_promotions: {
        columns: [
            "id",
            "code",
            "amount_cents",
            "currency",
            "description",
            "starts_at",
            "ends_at",
            "max_redemptions",
            "active",
            "created_at",
        ],
    },
    balance_promotion_redemptions: {
        columns: [
            "id",
            "promotion_id",
            "user_id",
            "stripe_customer_id",
            "stripe_transaction_id",
            "amount_cents",
            "redeemed_at",
        ],
    },
    dropship_lots: {
        columns: [
            "id",
            "cj_pid",
            "cj_vid",
            "cj_product_name",
            "cj_variant_name",
            "cj_cost_cents",
            "cj_shipping_cents",
            "cj_logistic_name",
            "cj_from_country",
            "cj_images",
            "basta_sale_id",
            "basta_item_id",
            "starting_bid_cents",
            "reserve_cents",
            "winner_user_id",
            "winning_bid_cents",
            "basta_order_id",
            "stripe_invoice_id",
            "cj_order_id",
            "cj_order_number",
            "cj_order_status",
            "cj_paid_at",
            "shipping_name",
            "shipping_address",
            "tracking_number",
            "tracking_carrier",
            "total_cost_cents",
            "profit_cents",
            "status",
            "error_message",
            "created_at",
            "updated_at",
        ],
    },
};

const expectedIndexes = [
    "idx_users_email",
    "idx_payment_orders_user",
    "idx_payment_orders_sale_user",
    "idx_payment_orders_stripe_invoice",
    "idx_payment_order_items_order",
    "idx_watchlist_user",
    "idx_lead_submissions_type",
    "idx_lead_submissions_email",
    "idx_lead_uploads_submission",
    "idx_lead_upload_files_created",
    "idx_lead_newsletter_unique",
    "idx_balance_promotions_code",
    "idx_balance_redemptions_promotion",
    "idx_balance_redemptions_user",
    "idx_dropship_lots_status",
    "idx_dropship_lots_basta_item",
    "idx_dropship_lots_basta_sale",
    "idx_dropship_lots_cj_order",
    "idx_dropship_lots_cj_vid_sale",
];

async function getTableColumns(params: { db: ReturnType<typeof createClient>; table: string }) {
    const { db, table } = params;
    const res = await db.execute(`PRAGMA table_info(${table})`);
    return new Set(res.rows.map((row) => row.name as string));
}

async function main() {
    const url = process.env.TURSO_DATABASE_URL?.trim() || "file:./db/local.db";
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;

    const db = createClient({ url, authToken });
    try {
        const master = await db.execute(
            "SELECT name, type FROM sqlite_master WHERE type IN ('table','index')"
        );
        const tables = new Set(
            master.rows
                .filter((row) => row.type === "table")
                .map((row) => row.name as string)
        );
        const indexes = new Set(
            master.rows
                .filter((row) => row.type === "index")
                .map((row) => row.name as string)
        );

        const errors: string[] = [];

        for (const [table, spec] of Object.entries(expectedTables)) {
            if (!tables.has(table)) {
                errors.push(`Missing table: ${table}`);
                continue;
            }

            const columns = await getTableColumns({ db, table });
            for (const col of spec.columns) {
                if (!columns.has(col)) {
                    errors.push(`Missing column: ${table}.${col}`);
                }
            }
        }

        for (const index of expectedIndexes) {
            if (!indexes.has(index)) {
                errors.push(`Missing index: ${index}`);
            }
        }

        if (errors.length) {
            console.error("Database schema verification failed:");
            for (const err of errors) {
                console.error(`- ${err}`);
            }
            console.error("");
            console.error("Fix options:");
            console.error("- Run `pnpm db:init` to create missing tables/indexes.");
            console.error("- If using local SQLite and columns are missing, delete `db/local.db` and re-run `pnpm db:init`.");
            process.exitCode = 1;
            return;
        }

        console.log("Database schema OK.");
    } finally {
        db.close();
    }
}

main().catch((error) => {
    console.error("Database schema verification error:", error);
    process.exitCode = 1;
});
