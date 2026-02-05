import path from "path";
import dotenv from "dotenv";
import { createClient } from "@libsql/client";

let loaded = false;

function loadEnv() {
  if (loaded) return;
  loaded = true;
  dotenv.config({ path: path.join(process.cwd(), ".env.local"), quiet: true });
}

export function createTestDbClient() {
  loadEnv();
  const url = process.env.TURSO_DATABASE_URL?.trim() || "file:./db/local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;
  return createClient({ url, authToken });
}
