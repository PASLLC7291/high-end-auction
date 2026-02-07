/**
 * smart-source.ts — CLI entry point for the smart sourcing agent.
 *
 * Usage:
 *   pnpm pipeline:smart-source --publish              Full run, publish auctions
 *   pnpm pipeline:smart-source --dry-run               Score products, don't create auctions
 *   pnpm pipeline:smart-source --resume <run-id>       Resume an interrupted run
 *   pnpm pipeline:smart-source --num-auctions 3 --items-per-auction 300 --max-detail 500
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { runSmartSource, type SmartSourceOptions } from "../lib/smart-sourcing";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function getArg(name: string, defaultValue?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return defaultValue;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`Usage: pnpm pipeline:smart-source [options]

Smart Sourcing Agent — searches broadly across categories, scores products
on margin potential, and creates bulk auctions with custom close dates.

Reserve prices are computed by a financial model that guarantees profit after
Stripe fees (2.9% + $0.30), buyer premium, and CJ price fluctuation (20%).
Starting bids use penny-staggered auction psychology for organic appearance.

Options:
  --publish                 Publish auctions after creation (default: off)
  --dry-run                 Score products only, don't create auctions
  --resume <run-id>         Resume an interrupted run by ID
  --num-auctions <n>        Number of auctions to create (default: 3)
  --items-per-auction <n>   Target items per auction (default: 300)
  --max-detail <n>          Max products to evaluate in Phase 2 (default: 500)
  --buyer-premium <rate>    Buyer premium rate as decimal (default: 0.15 = 15%)
  --help, -h                Show this help message

Examples:
  pnpm pipeline:smart-source --publish
  pnpm pipeline:smart-source --dry-run
  pnpm pipeline:smart-source --resume 20260211-180000 --publish
  pnpm pipeline:smart-source --num-auctions 3 --items-per-auction 300 --buyer-premium 0.15
`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const options: SmartSourceOptions = {
  numAuctions: parseInt(getArg("--num-auctions", "3")!, 10),
  itemsPerAuction: parseInt(getArg("--items-per-auction", "300")!, 10),
  maxDetail: parseInt(getArg("--max-detail", "500")!, 10),
  publish: hasFlag("--publish"),
  dryRun: hasFlag("--dry-run"),
  resumeRunId: getArg("--resume"),
  buyerPremiumRate: parseFloat(getArg("--buyer-premium", "0.15")!),
};

const fmt = (rate: number) => `${(rate * 100).toFixed(1)}%`;

console.log("═══════════════════════════════════════════════════════════");
console.log("              SMART SOURCING AGENT");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Auctions:          ${options.numAuctions}`);
console.log(`  Items per auction: ${options.itemsPerAuction}`);
console.log(`  Max detail eval:   ${options.maxDetail}`);
console.log(`  Buyer premium:     ${fmt(options.buyerPremiumRate)}`);
console.log(`  Publish:           ${options.publish}`);
console.log(`  Dry run:           ${options.dryRun}`);
if (options.resumeRunId) {
  console.log(`  Resuming run:      ${options.resumeRunId}`);
}
console.log("");
console.log("  Pricing model:     Stripe 2.9% + $0.30 | CJ buffer 20% | margin 5%");
console.log("  Starting bids:     Penny-staggered (auction psychology)");
console.log("═══════════════════════════════════════════════════════════\n");

runSmartSource(options).catch((error) => {
  console.error("[smart-source] Fatal error:", error);
  process.exit(1);
});
