import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { CJClient } from "../lib/cj-client";

/**
 * Quick smoke test for CJ client with corrected API types.
 * Uses persisted token — no auth call burned.
 */
async function main() {
  const cj = new CJClient(process.env.CJ_API_KEY!);

  // Search
  console.log("--- Search ---");
  const results = await cj.searchProducts({
    keyWord: "wireless headphones",
    size: 2,
  });
  console.log(`Found ${results.totalRecords} products, got ${results.products.length}`);
  const first = results.products[0];
  if (!first) { console.log("No products"); return; }
  console.log(`First: ${first.nameEn} ($${first.sellPrice}) stock: ${first.warehouseInventoryNum}`);

  // Detail
  console.log("\n--- Detail ---");
  const detail = await cj.getProduct({ pid: first.id });
  console.log(`Name: ${detail.productNameEn}`);
  console.log(`Images: ${detail.productImageSet?.length ?? 0}`);
  console.log(`Variants: ${detail.variants?.length ?? 0}`);
  const v = detail.variants?.[0];
  if (!v) { console.log("No variants"); return; }
  console.log(`First variant: ${v.variantNameEn} $${v.variantSellPrice} (vid: ${v.vid})`);

  // Inventory
  console.log("\n--- Inventory ---");
  const inv = await cj.getInventoryByVariant(v.vid);
  for (const i of inv) {
    console.log(`  ${i.areaEn} (${i.countryCode}): ${i.totalInventoryNum} units`);
  }

  // Freight
  console.log("\n--- Freight (CN→US) ---");
  const freight = await cj.calculateFreight({
    startCountryCode: "CN",
    endCountryCode: "US",
    products: [{ vid: v.vid, quantity: 1 }],
  });
  const top3 = freight
    .sort((a, b) => a.logisticPrice - b.logisticPrice)
    .slice(0, 3);
  for (const f of top3) {
    console.log(`  ${f.logisticName}: $${f.logisticPrice} (${f.logisticAging} days)`);
  }

  // Balance
  console.log("\n--- Balance ---");
  const bal = await cj.getBalance();
  console.log(`  $${bal.amount} (frozen: $${bal.freezeAmount})`);

  // Summary
  const costCents = Math.round(v.variantSellPrice * 100);
  const shipCents = Math.round(top3[0].logisticPrice * 100);
  const total = costCents + shipCents;
  console.log("\n--- Pricing Calc ---");
  console.log(`  Cost: $${(costCents / 100).toFixed(2)}`);
  console.log(`  Shipping: $${(shipCents / 100).toFixed(2)}`);
  console.log(`  Total cost: $${(total / 100).toFixed(2)}`);
  console.log(`  Starting bid (50%): $${(total * 0.5 / 100).toFixed(2)}`);
  console.log(`  Reserve (130%): $${(total * 1.3 / 100).toFixed(2)}`);

  console.log("\nSmoke test PASSED");
}

main().catch(console.error);
