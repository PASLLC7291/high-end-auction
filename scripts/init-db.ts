import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { join } from "path";

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
