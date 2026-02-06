/**
 * CJ Dropshipping → Basta Auction Pipeline
 *
 * Sources products from CJ Dropshipping, checks inventory & freight,
 * calculates pricing, creates a Basta sale with lots, and publishes.
 *
 * Usage:
 *   pnpm tsx scripts/cj-source-and-list.ts
 *
 * Required env:
 *   CJ_API_KEY, ACCOUNT_ID, API_KEY
 *
 * This script is the SOURCED → LISTED → PUBLISHED pipeline.
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { CJClient } from "../lib/cj-client";
import { getManagementApiClient, getAccountId } from "../lib/basta-client";
import { insertDropshipLot, updateDropshipLot } from "../lib/dropship";

// ============================================================================
// CONFIGURE YOUR SOURCING RUN HERE
// ============================================================================

const SOURCING_CONFIG = {
  // CJ product search
  searchKeyword: "wireless headphones",
  maxProducts: 5,
  countryCode: "US", // prefer US warehouse for faster shipping
  maxCostUsd: 50, // skip products above this wholesale cost

  // Pricing strategy
  startingBidMultiplier: 0.5, // start at 50% of cost
  reserveMarginMultiplier: 1.3, // reserve at 130% of total cost (30% margin)

  // Auction timing
  auctionTitle: "Daily Deals - Dropship Auction",
  auctionDescription: "Electronics and accessories",
  // Opens 1 hour from now, closes 24 hours after open
  openOffsetMs: 60 * 60 * 1000,
  durationMs: 24 * 60 * 60 * 1000,

  // Shipping destination for freight calc
  shippingDestination: "US",

  // Publish immediately?
  publishAfterCreate: false,
};

// ============================================================================
// PIPELINE
// ============================================================================

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

// CJ free tier: 1 req/sec. Add delay between calls.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CJ_DELAY_MS = 1200; // 1.2s between CJ calls

async function main() {
  console.log("=== CJ Dropshipping → Basta Pipeline ===\n");

  const cjApiKey = process.env.CJ_API_KEY?.trim();
  if (!cjApiKey) {
    console.error("Missing CJ_API_KEY in .env.local");
    process.exit(1);
  }

  const cj = new CJClient(cjApiKey);
  const bastaClient = getManagementApiClient();
  const accountId = getAccountId();

  // ── Step 1: Auth handled automatically (token persisted to .cj-token.json)

  // ── Step 2: Search products ────────────────────────────────────────────
  console.log(
    `[2/7] Searching CJ for "${SOURCING_CONFIG.searchKeyword}" (max ${SOURCING_CONFIG.maxProducts})...`
  );
  const searchResult = await cj.searchProducts({
    keyWord: SOURCING_CONFIG.searchKeyword,
    size: SOURCING_CONFIG.maxProducts * 2, // fetch extra to filter
    countryCode: SOURCING_CONFIG.countryCode,
    orderBy: 1, // sort by listings (popularity)
  });

  console.log(`  Found ${searchResult.totalRecords} total, fetched ${searchResult.products.length}\n`);

  if (!searchResult.products.length) {
    console.log("No products found. Try a different keyword.");
    process.exit(0);
  }

  // ── Step 3: Get details, check inventory, calc freight ─────────────────
  console.log("[3/7] Checking inventory & freight for each product...\n");

  const candidates: SourcingCandidate[] = [];
  const seenVids = new Set<string>(); // track variant IDs to skip duplicates

  for (const product of searchResult.products) {
    if (candidates.length >= SOURCING_CONFIG.maxProducts) break;

    // sellPrice is a string like "8.7 -- 10.19" or "1.65"
    const priceStr = product.sellPrice.split(/\s*--\s*/)[0];
    const costUsd = parseFloat(priceStr);
    if (isNaN(costUsd) || costUsd > SOURCING_CONFIG.maxCostUsd) {
      console.log(`  SKIP ${product.nameEn} — $${costUsd} > max $${SOURCING_CONFIG.maxCostUsd}`);
      continue;
    }

    // Quick stock check from search result
    if (product.warehouseInventoryNum < 1) {
      console.log(`  SKIP ${product.nameEn} — out of stock`);
      continue;
    }

    // Get full details + variants (search uses `id`, detail uses `pid`)
    await sleep(CJ_DELAY_MS);
    let fullProduct;
    try {
      fullProduct = await cj.getProduct({ pid: product.id });
    } catch (e) {
      console.log(`  SKIP ${product.nameEn} — failed to get details: ${e}`);
      continue;
    }

    const variants = fullProduct.variants ?? [];
    const variant = variants[0]; // take first variant
    if (!variant) {
      console.log(`  SKIP ${product.nameEn} — no variants`);
      continue;
    }

    // Dedup: skip if we already sourced this variant
    if (seenVids.has(variant.vid)) {
      console.log(`  SKIP ${product.nameEn} — duplicate VID ${variant.vid}`);
      continue;
    }
    seenVids.add(variant.vid);

    // Check inventory for specific variant
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

    // Determine origin country from inventory
    const fromCountry = inventory.find((i) => i.totalInventoryNum > 0)?.countryCode ?? "CN";

    // Calculate freight
    await sleep(CJ_DELAY_MS);
    let freightOptions;
    try {
      freightOptions = await cj.calculateFreight({
        startCountryCode: fromCountry,
        endCountryCode: SOURCING_CONFIG.shippingDestination,
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

    // Pick cheapest shipping
    const cheapest = freightOptions.sort(
      (a, b) => a.logisticPrice - b.logisticPrice
    )[0];

    // Calculate pricing (all in cents)
    const costCents = Math.round(variant.variantSellPrice * 100);
    const shippingCents = Math.round(cheapest.logisticPrice * 100);
    const totalCostCents = costCents + shippingCents;
    const startingBidCents = Math.round(
      totalCostCents * SOURCING_CONFIG.startingBidMultiplier
    );
    const reserveCents = Math.round(
      totalCostCents * SOURCING_CONFIG.reserveMarginMultiplier
    );

    // Collect images — search gives bigImage, detail gives productImageSet
    const images = fullProduct.productImageSet?.length
      ? fullProduct.productImageSet
      : [product.bigImage].filter(Boolean);

    candidates.push({
      pid: fullProduct.pid,
      vid: variant.vid,
      productName: fullProduct.productNameEn || product.nameEn,
      variantName: variant.variantNameEn || variant.variantName || "",
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
      `  OK ${product.nameEn} — cost $${(costCents / 100).toFixed(2)} + ship $${(shippingCents / 100).toFixed(2)} = $${(totalCostCents / 100).toFixed(2)} | reserve $${(reserveCents / 100).toFixed(2)} | stock ${totalStock} | ${cheapest.logisticName} (${cheapest.logisticAging})`
    );
  }

  console.log(`\n  ${candidates.length} products ready to list\n`);

  if (!candidates.length) {
    console.log("No viable products. Try different search terms or increase maxCostUsd.");
    process.exit(0);
  }

  // ── Step 4: Save to local DB ───────────────────────────────────────────
  console.log("[4/7] Saving sourcing data to local DB...");

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

  // ── Step 5: Create Basta sale ──────────────────────────────────────────
  console.log("[5/7] Creating Basta sale...");

  let saleId: string;
  try {
    const saleResult = await bastaClient.mutation({
      createSale: {
        __args: {
          accountId,
          input: {
            title: SOURCING_CONFIG.auctionTitle,
            description: SOURCING_CONFIG.auctionDescription,
            currency: "USD",
            closingMethod: "OVERLAPPING",
            closingTimeCountdown: 120000,
            bidIncrementTable: {
              rules: [
                { lowRange: 0, highRange: 1000, step: 100 },       // $0-$10: $1 increments
                { lowRange: 1000, highRange: 5000, step: 250 },     // $10-$50: $2.50
                { lowRange: 5000, highRange: 10000, step: 500 },    // $50-$100: $5
                { lowRange: 10000, highRange: 50000, step: 1000 },  // $100-$500: $10
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
    if (!saleId) {
      throw new Error("No sale ID returned from Basta");
    }
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

  // Create and attach a registration policy requiring shipping address (raw GQL — not in SDK)
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

  // ── Step 6: Create items in the sale ───────────────────────────────────
  console.log("[6/7] Adding items to sale...\n");

  const openDate = new Date(Date.now() + SOURCING_CONFIG.openOffsetMs).toISOString();
  const closingDate = new Date(
    Date.now() + SOURCING_CONFIG.openOffsetMs + SOURCING_CONFIG.durationMs
  ).toISOString();

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
          // 1. Get signed upload URL from Basta
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

          // 2. Download CJ image
          const imgResponse = await fetch(c.images[j]);
          if (!imgResponse.ok) {
            console.warn(`    Image ${j + 1}: CJ download failed (${imgResponse.status})`);
            continue;
          }
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

          // 3. PUT to signed S3 URL with required headers
          const putHeaders: Record<string, string> = {
            "Content-Type": "image/jpeg",
          };
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

      // Update local DB with Basta IDs
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

  // ── Step 7: Optionally publish ─────────────────────────────────────────
  if (SOURCING_CONFIG.publishAfterCreate) {
    console.log("\n[7/7] Publishing sale...");
    await bastaClient.mutation({
      publishSale: {
        __args: { accountId, input: { saleId } },
        id: true,
        status: true,
      },
    });

    // Update all lots to PUBLISHED
    for (const lotId of lotIds) {
      await updateDropshipLot(lotId, { status: "PUBLISHED" });
    }

    console.log("  Sale published!");
  } else {
    console.log("\n[7/7] Skipping publish (set publishAfterCreate: true to auto-publish)");
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("                    SOURCING COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Sale ID:        ${saleId}`);
  console.log(`Items listed:   ${candidates.length}`);
  console.log(`Opens at:       ${openDate}`);
  console.log(`Closes at:      ${closingDate}`);
  console.log(`Dashboard:      https://dashboard.basta.app/sales/${saleId}`);
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
