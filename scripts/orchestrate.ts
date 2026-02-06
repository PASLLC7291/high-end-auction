/**
 * orchestrate.ts — Single CLI entry point for the dropship pipeline.
 *
 * Subcommands:
 *   pnpm pipeline:source  --keyword "phone stand" --max-cost 15 --max-products 5 --publish
 *   pnpm pipeline:monitor --sale-id <id> --poll-interval 30
 *   pnpm pipeline:run     --keyword "phone stand" --max-cost 15
 *   pnpm pipeline:status  [--sale-id <id>]
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { CJClient } from "../lib/cj-client";
import { getManagementApiClient, getAccountId } from "../lib/basta-client";
import { insertDropshipLot, updateDropshipLot, getDropshipLotsBySale } from "../lib/dropship";
import {
  pollAndProcessClosedSales,
  retryFailedFulfillments,
  processRefunds,
  getSaleStatus,
  getStatusDashboard,
  checkCjQuota,
  type QuotaReport,
} from "../lib/pipeline";
import {
  listKeywords,
  insertKeyword,
  deleteKeyword,
} from "../lib/sourcing-keywords";

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

function getArg(name: string, defaultValue?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return defaultValue;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CJ_DELAY_MS = 1200;

// ---------------------------------------------------------------------------
// Quota display helper
// ---------------------------------------------------------------------------

function printQuotaReport(report: QuotaReport): void {
  console.log("\n=== CJ API Quota ===");

  if (report.quotas.length === 0) {
    console.log("  No quota data available.");
    return;
  }

  for (const q of report.quotas) {
    const usedStr = q.used === -1 ? "unknown" : String(q.used);
    const remainStr = q.remaining === -1 ? "unknown" : String(q.remaining);
    const pct = q.total > 0 && q.used >= 0 ? ((q.used / q.total) * 100).toFixed(1) : "?";
    const warning = q.remaining >= 0 && q.remaining < 100 ? " << CRITICALLY LOW" : "";
    console.log(
      `  ${q.endpoint.padEnd(40)} ${usedStr}/${q.total} used (${remainStr} remaining, ${pct}%)${warning}`
    );
  }

  if (!report.healthy) {
    console.log("\n  *** WARNING: Some endpoints are critically low on quota! ***");
    for (const q of report.criticallyLow) {
      console.log(`  *** ${q.endpoint}: only ${q.remaining} calls remaining ***`);
    }
  } else {
    console.log("\n  Quota status: HEALTHY");
  }
}

// ---------------------------------------------------------------------------
// source — CJ sourcing + Basta sale creation
// ---------------------------------------------------------------------------

async function commandSource() {
  const keyword = getArg("--keyword", "wireless headphones")!;
  const maxCost = parseFloat(getArg("--max-cost", "50")!);
  const maxProducts = parseInt(getArg("--max-products", "5")!, 10);
  const publish = hasFlag("--publish");

  console.log("=== Pipeline: Source ===");
  console.log(`  Keyword:      ${keyword}`);
  console.log(`  Max cost:     $${maxCost}`);
  console.log(`  Max products: ${maxProducts}`);
  console.log(`  Publish:      ${publish}\n`);

  const cjApiKey = process.env.CJ_API_KEY?.trim();
  if (!cjApiKey) {
    console.error("Missing CJ_API_KEY in .env.local");
    process.exit(1);
  }

  const cj = new CJClient(cjApiKey);
  const bastaClient = getManagementApiClient();
  const accountId = getAccountId();

  // Pre-flight: Check CJ API quota
  try {
    const quotaReport = await checkCjQuota();
    printQuotaReport(quotaReport);
    if (!quotaReport.healthy) {
      console.log(
        "\n  *** CJ API quota is critically low. Sourcing will continue, but be aware ***"
      );
      console.log(
        "  *** that API calls may fail if limits are exceeded. ***\n"
      );
    }
    console.log("");
  } catch (e) {
    console.warn("[source] Failed to check CJ quota (non-blocking):", e);
  }

  // Step 1: Search CJ
  console.log(`[1/7] Searching CJ for "${keyword}"...`);
  const searchResult = await cj.searchProducts({
    keyWord: keyword,
    size: maxProducts * 2,
    countryCode: "US",
    orderBy: 1,
  });

  console.log(`  Found ${searchResult.totalRecords} total, fetched ${searchResult.products.length}\n`);

  if (!searchResult.products.length) {
    console.log("No products found. Try a different keyword.");
    return;
  }

  // Step 2: Get details, check inventory, calc freight
  console.log("[2/7] Checking inventory & freight...\n");

  type SourcingCandidate = {
    pid: string;
    vid: string;
    productName: string;
    variantName: string;
    costCents: number;
    shippingCents: number;
    logisticName: string;
    fromCountry: string;
    images: string[];
    description: string;
    startingBidCents: number;
    reserveCents: number;
    totalCostCents: number;
  };

  const candidates: SourcingCandidate[] = [];
  const seenVids = new Set<string>();

  for (const product of searchResult.products) {
    if (candidates.length >= maxProducts) break;

    const priceStr = product.sellPrice.split(/\s*--\s*/)[0];
    const costUsd = parseFloat(priceStr);
    if (isNaN(costUsd) || costUsd > maxCost) {
      console.log(`  SKIP ${product.nameEn} — $${costUsd} > max $${maxCost}`);
      continue;
    }

    if (product.warehouseInventoryNum < 1) {
      console.log(`  SKIP ${product.nameEn} — out of stock`);
      continue;
    }

    await sleep(CJ_DELAY_MS);
    let fullProduct;
    try {
      fullProduct = await cj.getProduct({ pid: product.id });
    } catch (e) {
      console.log(`  SKIP ${product.nameEn} — failed to get details: ${e}`);
      continue;
    }

    const variants = fullProduct.variants ?? [];
    const variant = variants[0];
    if (!variant) {
      console.log(`  SKIP ${product.nameEn} — no variants`);
      continue;
    }

    if (seenVids.has(variant.vid)) {
      console.log(`  SKIP ${product.nameEn} — duplicate VID ${variant.vid}`);
      continue;
    }
    seenVids.add(variant.vid);

    await sleep(CJ_DELAY_MS);
    let inventory;
    try {
      inventory = await cj.getInventoryByVariant(variant.vid);
    } catch {
      console.log(`  SKIP ${product.nameEn} — inventory check failed`);
      continue;
    }

    const totalStock = inventory.reduce((sum, inv) => sum + inv.totalInventoryNum, 0);
    if (totalStock < 1) {
      console.log(`  SKIP ${product.nameEn} — variant out of stock`);
      continue;
    }

    const fromCountry = inventory.find((i) => i.totalInventoryNum > 0)?.countryCode ?? "CN";

    await sleep(CJ_DELAY_MS);
    let freightOptions;
    try {
      freightOptions = await cj.calculateFreight({
        startCountryCode: fromCountry,
        endCountryCode: "US",
        products: [{ vid: variant.vid, quantity: 1 }],
      });
    } catch {
      console.log(`  SKIP ${product.nameEn} — freight calc failed`);
      continue;
    }

    if (!freightOptions.length) {
      console.log(`  SKIP ${product.nameEn} — no shipping options`);
      continue;
    }

    const cheapest = freightOptions.sort((a, b) => a.logisticPrice - b.logisticPrice)[0];

    const costCents = Math.round(variant.variantSellPrice * 100);
    const shippingCents = Math.round(cheapest.logisticPrice * 100);
    const totalCostCents = costCents + shippingCents;
    const startingBidCents = Math.round(totalCostCents * 0.5);
    const reserveCents = Math.round(totalCostCents * 1.3);

    const images = fullProduct.productImageSet?.length
      ? fullProduct.productImageSet
      : [product.bigImage].filter(Boolean);

    candidates.push({
      pid: fullProduct.pid,
      vid: variant.vid,
      productName: fullProduct.productNameEn || product.nameEn,
      variantName: variant.variantNameEn || "",
      costCents,
      shippingCents,
      logisticName: cheapest.logisticName,
      fromCountry,
      images,
      description: fullProduct.description || product.nameEn,
      startingBidCents,
      reserveCents,
      totalCostCents,
    });

    console.log(
      `  OK ${product.nameEn} — $${(costCents / 100).toFixed(2)} + ship $${(shippingCents / 100).toFixed(2)} = $${(totalCostCents / 100).toFixed(2)} | reserve $${(reserveCents / 100).toFixed(2)} | stock ${totalStock}`
    );
  }

  console.log(`\n  ${candidates.length} products ready to list\n`);

  if (!candidates.length) {
    console.log("No viable products. Try different search terms or increase --max-cost.");
    return;
  }

  // Step 3: Save to local DB
  console.log("[3/7] Saving sourcing data to local DB...");
  const lotIds: string[] = [];
  for (const c of candidates) {
    const lotId = await insertDropshipLot({
      cj_pid: c.pid,
      cj_vid: c.vid,
      cj_product_name: c.productName,
      cj_variant_name: c.variantName,
      cj_cost_cents: c.costCents,
      cj_shipping_cents: c.shippingCents,
      cj_logistic_name: c.logisticName,
      cj_from_country: c.fromCountry,
      cj_images: c.images,
      starting_bid_cents: c.startingBidCents,
      reserve_cents: c.reserveCents,
    });
    lotIds.push(lotId);
    console.log(`  Saved lot ${lotId} — ${c.productName}`);
  }
  console.log("");

  // Step 4: Create Basta sale
  console.log("[4/7] Creating Basta sale...");
  let saleId: string;
  try {
    const saleResult = await bastaClient.mutation({
      createSale: {
        __args: {
          accountId,
          input: {
            title: `Dropship Auction — ${keyword}`,
            description: `Auto-sourced: ${keyword}`,
            currency: "USD",
            closingMethod: "OVERLAPPING",
            closingTimeCountdown: 120000,
            bidIncrementTable: {
              rules: [
                { lowRange: 0, highRange: 1000, step: 100 },
                { lowRange: 1000, highRange: 5000, step: 250 },
                { lowRange: 5000, highRange: 10000, step: 500 },
                { lowRange: 10000, highRange: 50000, step: 1000 },
              ],
            },
          },
        },
        id: true,
        title: true,
        status: true,
      },
    });

    saleId = saleResult.createSale?.id as string;
    if (!saleId) throw new Error("No sale ID returned from Basta");
  } catch (e: unknown) {
    const err = e as { errors?: Array<{ message: string; extensions?: Record<string, unknown> }> };
    console.error("  Basta createSale failed:");
    if (err.errors) {
      for (const gqlErr of err.errors) {
        console.error("    -", gqlErr.message, gqlErr.extensions ?? "");
      }
    } else {
      console.error("   ", e);
    }
    throw e;
  }
  console.log(`  Created sale: ${saleId}`);

  // Attach registration policy requiring shipping address
  try {
    const apiKey = process.env.API_KEY?.trim() ?? "";
    const gqlUrl = "https://management.api.basta.app/graphql";
    const gqlHeaders = {
      "Content-Type": "application/json",
      "x-account-id": accountId,
      "x-api-key": apiKey,
    };

    const policyRes = await fetch(gqlUrl, {
      method: "POST",
      headers: gqlHeaders,
      body: JSON.stringify({
        query: `mutation ($accountId: String!, $input: CreateSaleRegistrationPolicyInput!) {
          createSaleRegistrationPolicy(accountId: $accountId, input: $input) { id code }
        }`,
        variables: {
          accountId,
          input: {
            code: "require_shipping_address",
            description: "Bidders must provide a shipping address before bidding",
            rule: 'size(user.addresses.filter(a, a.addressType == "SHIPPING")) > 0',
          },
        },
      }),
    });

    const policyData = (await policyRes.json()) as {
      data?: { createSaleRegistrationPolicy?: { id: string; code: string } };
    };
    const policyId = policyData.data?.createSaleRegistrationPolicy?.id;

    if (policyId) {
      await fetch(gqlUrl, {
        method: "POST",
        headers: gqlHeaders,
        body: JSON.stringify({
          query: `mutation ($accountId: String!, $input: AttachSaleRegistrationPoliciesInput!) {
            attachSaleRegistrationPolicies(accountId: $accountId, input: $input) { id }
          }`,
          variables: {
            accountId,
            input: { saleId, policyIds: [policyId] },
          },
        }),
      });
      console.log(`  Attached shipping address policy: ${policyId}`);
    }
  } catch (e) {
    console.warn("  Failed to create/attach registration policy (non-blocking):", e);
  }
  console.log("");

  // Step 5: Create items in the sale
  console.log("[5/7] Adding items to sale...\n");

  const openDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const closingDate = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const lotId = lotIds[i];

    try {
      const itemResult = await bastaClient.mutation({
        createItemForSale: {
          __args: {
            accountId,
            input: {
              saleId,
              title: c.productName,
              description: c.description,
              startingBid: c.startingBidCents,
              reserve: c.reserveCents,
              openDate,
              closingDate,
              allowedBidTypes: ["MAX", "NORMAL"],
              ItemNumber: i + 1,
            },
          },
          id: true,
          title: true,
        },
      });

      const itemId = itemResult.createItemForSale?.id as string;
      if (!itemId) throw new Error("No item ID returned");

      // Upload images via Basta's signed URL flow
      for (let j = 0; j < c.images.length; j++) {
        try {
          const uploadResult = await bastaClient.mutation({
            createUploadUrl: {
              __args: {
                accountId,
                input: {
                  imageTypes: ["SALE_ITEM"],
                  contentType: "image/jpeg",
                  order: j + 1,
                  saleId,
                  itemId,
                },
              },
              imageId: true,
              uploadUrl: true,
              imageUrl: true,
              headers: { key: true, value: true },
            },
          });

          const uploadData = uploadResult.createUploadUrl;
          if (!uploadData?.uploadUrl) {
            console.warn(`    Image ${j + 1}: no upload URL returned`);
            continue;
          }

          const imgResponse = await fetch(c.images[j]);
          if (!imgResponse.ok) {
            console.warn(`    Image ${j + 1}: CJ download failed (${imgResponse.status})`);
            continue;
          }
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

          const putHeaders: Record<string, string> = { "Content-Type": "image/jpeg" };
          for (const h of uploadData.headers ?? []) {
            if (h.key !== "Host") {
              putHeaders[h.key] = h.value;
            }
          }

          const putResponse = await fetch(uploadData.uploadUrl, {
            method: "PUT",
            headers: putHeaders,
            body: imgBuffer,
          });

          if (putResponse.ok) {
            console.log(`    Image ${j + 1}: uploaded → ${uploadData.imageUrl}`);
          } else {
            console.warn(`    Image ${j + 1}: S3 PUT failed (${putResponse.status})`);
          }
        } catch (imgErr) {
          console.warn(`    Image upload failed: ${imgErr}`);
        }
      }

      await updateDropshipLot(lotId, {
        basta_sale_id: saleId,
        basta_item_id: itemId,
        status: "LISTED",
      });

      console.log(`  [${i + 1}/${candidates.length}] ${c.productName} → item ${itemId}`);
    } catch (error) {
      console.error(`  [${i + 1}/${candidates.length}] FAILED: ${c.productName}`, error);
      await updateDropshipLot(lotId, {
        status: "CANCELLED",
        error_message: String(error),
      });
    }
  }

  // Step 6: Optionally publish
  if (publish) {
    console.log("\n[6/7] Publishing sale...");
    await bastaClient.mutation({
      publishSale: {
        __args: { accountId, input: { saleId } },
        id: true,
        status: true,
      },
    });

    for (const lotId of lotIds) {
      await updateDropshipLot(lotId, { status: "PUBLISHED" });
    }
    console.log("  Sale published!");
  } else {
    console.log("\n[6/7] Skipping publish (use --publish to auto-publish)");
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("                    SOURCING COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Sale ID:        ${saleId}`);
  console.log(`Items listed:   ${candidates.length}`);
  console.log(`Opens at:       ${openDate}`);
  console.log(`Closes at:      ${closingDate}`);
  console.log(`Dashboard:      https://dashboard.basta.app/sales/${saleId}`);
  console.log("═══════════════════════════════════════════════════════════");

  return saleId;
}

// ---------------------------------------------------------------------------
// monitor — Poll sale status → process winners → retry → refund → loop
// ---------------------------------------------------------------------------

async function commandMonitor() {
  const saleId = getArg("--sale-id");
  const pollInterval = parseInt(getArg("--poll-interval", "30")!, 10);

  if (!saleId) {
    console.error("Usage: pnpm pipeline:monitor --sale-id <id> [--poll-interval 30]");
    process.exit(1);
  }

  console.log("=== Pipeline: Monitor ===");
  console.log(`  Sale ID:       ${saleId}`);
  console.log(`  Poll interval: ${pollInterval}s\n`);

  let iteration = 0;

  while (true) {
    iteration++;
    console.log(`\n--- Iteration ${iteration} (${new Date().toISOString()}) ---`);

    // Check sale status
    try {
      const status = await getSaleStatus(saleId);
      console.log(`[monitor] Sale status: ${status.status}`);
      console.log(`[monitor] Items: ${status.items.length}`);

      if (status.status === "CLOSED") {
        console.log("[monitor] Sale is CLOSED — processing winners...");

        // Step 1: Poll and process closed sales
        await pollAndProcessClosedSales();

        // Step 2: Retry failed fulfillments
        await retryFailedFulfillments();

        // Step 3: Process refunds
        await processRefunds();
      }
    } catch (e) {
      console.error("[monitor] Error:", e);
    }

    // Check if all lots for this sale are terminal
    try {
      const lots = await getDropshipLotsBySale(saleId);
      const terminalStatuses = [
        "DELIVERED", "SHIPPED", "CJ_PAID", "CANCELLED", "RESERVE_NOT_MET",
      ];
      const allTerminal = lots.length > 0 && lots.every(
        (lot) => terminalStatuses.includes(lot.status)
      );

      if (allTerminal) {
        console.log("\n[monitor] All lots have reached a terminal state. Exiting.");
        printLotsSummary(lots);
        break;
      }

      const statusCounts: Record<string, number> = {};
      for (const lot of lots) {
        statusCounts[lot.status] = (statusCounts[lot.status] ?? 0) + 1;
      }
      console.log("[monitor] Lot statuses:", statusCounts);
    } catch (e) {
      console.error("[monitor] Failed to check lot statuses:", e);
    }

    console.log(`[monitor] Sleeping ${pollInterval}s...`);
    await sleep(pollInterval * 1000);
  }
}

function printLotsSummary(lots: { id: string; cj_product_name: string; status: string; profit_cents: number | null }[]) {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("                     FINAL SUMMARY");
  console.log("═══════════════════════════════════════════════════════════");
  for (const lot of lots) {
    const profit = lot.profit_cents != null ? ` profit: $${(lot.profit_cents / 100).toFixed(2)}` : "";
    console.log(`  ${lot.status.padEnd(18)} ${lot.cj_product_name}${profit}`);
  }
  console.log("═══════════════════════════════════════════════════════════");
}

// ---------------------------------------------------------------------------
// run — source + monitor in sequence
// ---------------------------------------------------------------------------

async function commandRun() {
  console.log("=== Pipeline: Run (Source → Monitor) ===\n");

  const saleId = await commandSource();
  if (!saleId) {
    console.error("[run] Source command did not return a sale ID.");
    process.exit(1);
  }

  // Inject --sale-id for monitor
  process.argv.push("--sale-id", saleId);
  await commandMonitor();
}

// ---------------------------------------------------------------------------
// status — Dashboard
// ---------------------------------------------------------------------------

async function commandStatus() {
  const saleId = getArg("--sale-id");

  if (saleId) {
    // Show status for a specific sale
    console.log(`=== Pipeline: Status for sale ${saleId} ===\n`);

    try {
      const status = await getSaleStatus(saleId);
      console.log(`Sale status: ${status.status}`);
      console.log(`Currency:    ${status.currency}`);
      console.log(`Items:       ${status.items.length}\n`);

      for (const item of status.items) {
        const winner = item.leaderId ? `winner=${item.leaderId} bid=${item.currentBid}` : "no bids";
        console.log(`  ${item.status.padEnd(15)} ${item.title ?? item.id} — ${winner}`);
      }
    } catch (e) {
      console.error("Failed to fetch sale status:", e);
    }

    // Show local lots for this sale
    const lots = await getDropshipLotsBySale(saleId);
    if (lots.length) {
      console.log(`\nLocal lots (${lots.length}):\n`);
      for (const lot of lots) {
        console.log(
          `  ${lot.status.padEnd(18)} ${lot.cj_product_name} (lot: ${lot.id.slice(0, 8)})`
        );
        if (lot.error_message) console.log(`    ERROR: ${lot.error_message}`);
      }
    }
    return;
  }

  // Show full dashboard
  console.log("=== Pipeline: Status Dashboard ===\n");

  const dashboard = await getStatusDashboard();

  console.log(`Total lots: ${dashboard.total}\n`);

  console.log("By status:");
  for (const [status, count] of Object.entries(dashboard.byStatus).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${status.padEnd(18)} ${count}`);
  }

  if (dashboard.stuck.length > 0) {
    console.log(`\nStuck lots (${dashboard.stuck.length}):`);
    for (const lot of dashboard.stuck) {
      const age = Math.round(
        (Date.now() - new Date(lot.updated_at).getTime()) / 60000
      );
      console.log(
        `  ${lot.status.padEnd(18)} ${lot.cj_product_name} (${age}m ago, lot: ${lot.id.slice(0, 8)})`
      );
    }
  }

  if (dashboard.failed.length > 0) {
    console.log(`\nFailed lots (${dashboard.failed.length}):`);
    for (const lot of dashboard.failed) {
      console.log(
        `  ${lot.status.padEnd(18)} ${lot.cj_product_name} — ${lot.error_message ?? "no error"}`
      );
    }
  }

  // Financial summary
  const f = dashboard.financials;
  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  console.log(`\n=== Financials ===`);
  console.log(`  Revenue:     ${fmt(f.totalRevenue)} (${f.lotsSold} lots sold)`);
  console.log(`  Cost:        ${fmt(f.totalCost)}`);
  console.log(`  Profit:      ${fmt(f.totalProfit)} (${f.profitMargin.toFixed(1)}% margin)`);
  console.log(`  Refunds:     ${f.refundCount} lots, ${fmt(f.refundAmount)} returned`);
  console.log(`  Delivered:   ${f.lotsDelivered} lots`);

  // CJ API quota report
  try {
    const quotaReport = await checkCjQuota();
    printQuotaReport(quotaReport);
  } catch (e) {
    console.warn("\n[status] Failed to check CJ API quota:", e);
  }
}

// ---------------------------------------------------------------------------
// keywords — Manage sourcing keywords for auto-sourcing rotation
// ---------------------------------------------------------------------------

async function commandKeywords() {
  const action = process.argv[3]; // list | add | remove

  if (!action || !["list", "add", "remove"].includes(action)) {
    console.log(`Usage: pnpm pipeline:keywords <action>

Actions:
  list                             List all sourcing keywords
  add    --keyword <term>          Add a keyword
         [--max-cost <usd>]        Max wholesale cost (default: 50)
         [--max-products <n>]      Max products per run (default: 5)
         [--priority <n>]          Priority (higher = first, default: 0)
  remove --id <id>                 Remove a keyword by ID
`);
    process.exit(1);
  }

  if (action === "list") {
    const keywords = await listKeywords();
    if (keywords.length === 0) {
      console.log("No sourcing keywords configured. Add one with: pnpm pipeline:keywords add --keyword \"phone stand\"");
      return;
    }

    console.log("=== Sourcing Keywords ===\n");
    console.log(
      "  " +
      "ID".padEnd(38) +
      "Keyword".padEnd(25) +
      "Cost".padEnd(8) +
      "Max".padEnd(5) +
      "Pri".padEnd(5) +
      "Active".padEnd(8) +
      "Runs".padEnd(6) +
      "Lots".padEnd(6) +
      "Last Sourced"
    );
    console.log("  " + "-".repeat(120));

    for (const kw of keywords) {
      const lastSourced = kw.last_sourced_at
        ? new Date(kw.last_sourced_at).toLocaleDateString()
        : "never";
      console.log(
        "  " +
        kw.id.slice(0, 36).padEnd(38) +
        kw.keyword.padEnd(25) +
        `$${kw.max_cost_usd}`.padEnd(8) +
        String(kw.max_products).padEnd(5) +
        String(kw.priority).padEnd(5) +
        (kw.active ? "yes" : "no").padEnd(8) +
        String(kw.total_runs).padEnd(6) +
        String(kw.total_lots_created).padEnd(6) +
        lastSourced
      );
    }
    console.log(`\n  Total: ${keywords.length} keyword(s)`);
    return;
  }

  if (action === "add") {
    const keyword = getArg("--keyword");
    if (!keyword) {
      console.error("Missing --keyword argument");
      process.exit(1);
    }
    const maxCostUsd = getArg("--max-cost") ? parseFloat(getArg("--max-cost")!) : undefined;
    const maxProducts = getArg("--max-products") ? parseInt(getArg("--max-products")!, 10) : undefined;
    const priority = getArg("--priority") ? parseInt(getArg("--priority")!, 10) : undefined;

    const id = await insertKeyword({ keyword, maxCostUsd, maxProducts, priority });
    console.log(`Added keyword "${keyword}" (id: ${id})`);
    return;
  }

  if (action === "remove") {
    const id = getArg("--id");
    if (!id) {
      console.error("Missing --id argument");
      process.exit(1);
    }
    await deleteKeyword(id);
    console.log(`Removed keyword ${id}`);
    return;
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const subcommand = process.argv[2];

const commands: Record<string, () => Promise<void | string>> = {
  source: commandSource,
  monitor: commandMonitor,
  run: commandRun,
  status: commandStatus,
  keywords: commandKeywords,
};

if (!subcommand || !commands[subcommand]) {
  console.log(`Usage: tsx scripts/orchestrate.ts <command>

Commands:
  source   Source products from CJ and create a Basta auction sale
           --keyword <term>       Search keyword (default: "wireless headphones")
           --max-cost <usd>       Max wholesale cost (default: 50)
           --max-products <n>     Max products to source (default: 5)
           --publish              Publish the sale immediately

  monitor  Poll a sale and auto-process winners, fulfillment, and refunds
           --sale-id <id>         Basta sale ID (required)
           --poll-interval <sec>  Poll interval in seconds (default: 30)

  run      Source + monitor in sequence (the "watch it go" command)
           (takes same args as source)

  status   Show dashboard of all dropship lots
           --sale-id <id>         Show status for a specific sale

  keywords Manage sourcing keywords for auto-sourcing rotation
           list                   List all keywords
           add --keyword <term>   Add a keyword (--max-cost, --max-products, --priority)
           remove --id <id>       Remove a keyword
`);
  process.exit(subcommand ? 1 : 0);
}

commands[subcommand]().catch((error) => {
  console.error(`[${subcommand}] Fatal error:`, error);
  process.exit(1);
});
