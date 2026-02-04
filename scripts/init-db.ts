import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { join } from "path";

async function initDatabase() {
    const url = process.env.TURSO_DATABASE_URL || "file:./db/local.db";
    const authToken = process.env.TURSO_AUTH_TOKEN;

    console.log(`Initializing database at: ${url}`);

    const db = createClient({ url, authToken });

    // Read and execute schema
    const schemaPath = join(process.cwd(), "db", "schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");

    // Split by semicolons and execute each statement
    const statements = schema
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    for (const statement of statements) {
        try {
            await db.execute(statement);
            console.log("Executed:", statement.substring(0, 50) + "...");
        } catch (error) {
            console.error("Failed to execute:", statement.substring(0, 50));
            console.error(error);
        }
    }

    console.log("Database initialized successfully!");
}

initDatabase().catch(console.error);
