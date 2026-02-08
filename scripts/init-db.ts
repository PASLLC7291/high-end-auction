import { config } from "dotenv";
import { join, resolve } from "path";

// Load environment variables from .env.local for local/dev usage.
// Deployment platforms (Vercel/Netlify) provide env vars directly.
config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

import { createClient } from "@libsql/client";
import { readFileSync, existsSync } from "fs";

async function initDatabase() {
    const url = process.env.TURSO_DATABASE_URL?.trim() || "file:./db/local.db";
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;

    console.log(`Initializing database at: ${url}`);

    const db = createClient({ url, authToken });

    const schemaPath = join(process.cwd(), "db", "schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");

    const tx = await db.transaction("write");
    try {
        await tx.executeMultiple(schema);

        // Run agent harness migration if it exists
        const agentMigrationPath = join(process.cwd(), "db", "migrations", "001-agent-harness.sql");
        if (existsSync(agentMigrationPath)) {
            const agentMigration = readFileSync(agentMigrationPath, "utf-8");
            await tx.executeMultiple(agentMigration);
            console.log("Agent harness migration applied.");
        }

        await tx.commit();
        console.log("Database initialized successfully!");
    } catch (error) {
        try {
            await tx.rollback();
        } catch {
            // Ignore rollback errors and surface the original failure.
        }
        console.error("Database initialization failed.");
        throw error;
    } finally {
        tx.close();
        db.close();
    }
}

initDatabase().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
