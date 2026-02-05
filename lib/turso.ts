import { createClient } from "@libsql/client";

// For local development, use file-based SQLite
// For production, use Turso cloud URL
const url = (process.env.TURSO_DATABASE_URL || "file:./db/local.db").trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

export const db = createClient({
    url,
    authToken,
});

// Helper to generate UUIDs (SQLite doesn't have gen_random_uuid)
export function generateId(): string {
    return crypto.randomUUID();
}
