/**
 * poll-closed-sales.ts
 *
 * Thin CLI wrapper around pollAndProcessClosedSales() from lib/pipeline.ts.
 *
 * Usage:
 *   pnpm tsx scripts/poll-closed-sales.ts
 *   pnpm tsx scripts/poll-closed-sales.ts --dry-run
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { pollAndProcessClosedSales } from "../lib/pipeline";

const dryRun = process.argv.includes("--dry-run");

pollAndProcessClosedSales({ dryRun }).catch((error) => {
  console.error("[poll] Fatal error:", error);
  process.exit(1);
});
