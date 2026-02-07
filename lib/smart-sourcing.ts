/**
 * Smart Sourcing Agent — Core scoring engine + two-phase pipeline.
 *
 * Phase 1: Wide search across categories (~160 CJ search calls)
 * Phase 2: Deep evaluation of top candidates (~1,500 CJ calls)
 * Phase 3: Create 3 stratified auctions with custom close dates
 *
 * Progress is saved to disk for resumability.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getCJClient, type CJSearchProduct, type CJProduct, type CJProductVariant, type CJFreightOption } from "@/lib/cj-client";
import { getManagementApiClient, getAccountId } from "@/lib/basta-client";
import { insertDropshipLot, updateDropshipLot } from "@/lib/dropship";
import { getAllKeywordsWithCategory } from "@/lib/sourcing-categories";
import { computePricing, printPricingTable } from "@/lib/auction-pricing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Phase1Candidate = {
  pid: string;
  nameEn: string;
  sellPrice: string;
  categoryId: string;
  category: string;         // our sourcing category name
  keyword: string;          // keyword that found it
  listedNum: number;
  inventory: number;
  isVideo: number;
  bigImage: string;
  phase1Score: number;
};

export type Phase2Candidate = {
  // Phase 1 data carried forward
  pid: string;
  nameEn: string;
  category: string;
  keyword: string;
  phase1Score: number;
  // Phase 2 enriched data
  productName: string;
  variantName: string;
  vid: string;
  costCents: number;
  shippingCents: number;
  totalCostCents: number;
  logisticName: string;
  fromCountry: string;
  images: string[];
  description: string;
  suggestedRetailCents: number;
  variantWeight: number;
  imageCount: number;
  phase2Score: number;
  // Pricing for auction
  startingBidCents: number;
  reserveCents: number;
};

export type AuctionConfig = {
  title: string;
  openDate: string;    // ISO 8601
  closingDate: string;  // ISO 8601
};

export type SmartSourceRunState = {
  runId: string;
  startedAt: string;
  buyerPremiumRate: number;
  phase1Complete: boolean;
  phase2Complete: boolean;
  phase3Complete: boolean;
  phase1Candidates: Phase1Candidate[];
  phase2Candidates: Phase2Candidate[];
  phase1KeywordsCompleted: string[];
  phase2ProcessedPids: string[];
  saleIds: string[];
  errors: string[];
};

export type SmartSourceOptions = {
  numAuctions: number;
  itemsPerAuction: number;
  maxDetail: number;
  publish: boolean;
  dryRun: boolean;
  resumeRunId?: string;
  /** Buyer premium rate (0.15 = 15%). Affects reserve calculation. */
  buyerPremiumRate: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RUNS_DIR = resolve(process.cwd(), "data", "smart-source-runs");
const CJ_DELAY_MS = 1200;
const BACKOFF_DELAY_MS = 3000;
const BACKOFF_THRESHOLD = 3;   // consecutive failures before backoff
const BACKOFF_COOLDOWN = 10;   // calls at backoff speed

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Run state persistence
// ---------------------------------------------------------------------------

function ensureRunsDir(): void {
  if (!existsSync(RUNS_DIR)) {
    mkdirSync(RUNS_DIR, { recursive: true });
  }
}

function getRunPath(runId: string): string {
  return resolve(RUNS_DIR, `${runId}.json`);
}

function saveRunState(state: SmartSourceRunState): void {
  ensureRunsDir();
  writeFileSync(getRunPath(state.runId), JSON.stringify(state, null, 2));
}

function loadRunState(runId: string): SmartSourceRunState | null {
  const path = getRunPath(runId);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as SmartSourceRunState;
  } catch {
    return null;
  }
}

function generateRunId(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// ---------------------------------------------------------------------------
// Phase 1: Wide Search
// ---------------------------------------------------------------------------

function parsePrice(sellPrice: string): number | null {
  const cleaned = sellPrice.split(/\s*--\s*/)[0].trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function scorePhase1(
  product: CJSearchProduct,
  category: string,
  categoryCounts: Map<string, number>,
  totalCandidates: number,
): number {
  let score = 0;

  // Popularity (30 pts): min(30, listedNum / 100 * 30)
  score += Math.min(30, (product.listedNum / 100) * 30);

  // Price sweet spot (25 pts): $3-$25 wholesale = full score
  const price = parsePrice(product.sellPrice);
  if (price !== null) {
    if (price >= 3 && price <= 25) {
      score += 25;
    } else if (price < 3) {
      score += Math.max(0, 25 - (3 - price) * 8);
    } else {
      // price > 25
      score += Math.max(0, 25 - (price - 25) * 1);
    }
  }

  // Inventory depth (20 pts): min(20, inventory / 50 * 20)
  score += Math.min(20, (product.warehouseInventoryNum / 50) * 20);

  // Media quality (10 pts): has video = 10, no video = 5
  score += product.isVideo ? 10 : 5;

  // Category diversity (15 pts): bonus for underrepresented categories
  if (totalCandidates > 0) {
    const catCount = categoryCounts.get(category) ?? 0;
    const catRatio = catCount / totalCandidates;
    // If this category is underrepresented (<average), give full bonus
    const numCategories = categoryCounts.size || 1;
    const avgRatio = 1 / numCategories;
    if (catRatio <= avgRatio) {
      score += 15;
    } else {
      score += Math.max(0, 15 * (1 - (catRatio - avgRatio) / avgRatio));
    }
  } else {
    score += 15; // first candidate gets full diversity bonus
  }

  return Math.round(score * 100) / 100;
}

export async function runPhase1(
  state: SmartSourceRunState,
): Promise<void> {
  if (state.phase1Complete) {
    console.log("[phase1] Already complete, skipping.");
    return;
  }

  const cj = getCJClient();
  const allKeywords = getAllKeywordsWithCategory();
  const seenPids = new Set(state.phase1Candidates.map((c) => c.pid));
  const categoryCounts = new Map<string, number>();

  // Rebuild category counts from existing candidates
  for (const c of state.phase1Candidates) {
    categoryCounts.set(c.category, (categoryCounts.get(c.category) ?? 0) + 1);
  }

  const completedSet = new Set(state.phase1KeywordsCompleted);
  const remainingKeywords = allKeywords.filter(
    (kw) => !completedSet.has(kw.keyword),
  );

  console.log(
    `[phase1] ${remainingKeywords.length} keywords remaining, ${state.phase1Candidates.length} candidates so far`,
  );

  let consecutiveFailures = 0;
  let backoffRemaining = 0;

  for (const { keyword, category } of remainingKeywords) {
    console.log(`[phase1] Searching "${keyword}" (${category})...`);

    // Search with two sort orders: by listing count, and by inventory
    for (const orderBy of [1, 4] as const) {
      const sortLabel = orderBy === 1 ? "listings" : "inventory";

      // Fetch up to 3 pages per sort order
      for (let page = 1; page <= 3; page++) {
        const delayMs = backoffRemaining > 0 ? BACKOFF_DELAY_MS : CJ_DELAY_MS;
        if (backoffRemaining > 0) backoffRemaining--;
        await sleep(delayMs);

        try {
          const result = await cj.searchProducts({
            keyWord: keyword,
            size: 20,
            page,
            countryCode: "US",
            orderBy,
          });

          consecutiveFailures = 0;

          if (!result.products.length) break;

          for (const product of result.products) {
            if (seenPids.has(product.id)) continue;

            // Pre-filter
            if (product.warehouseInventoryNum < 5) continue;
            const price = parsePrice(product.sellPrice);
            if (price === null) continue;
            if (product.listedNum < 5) continue;

            const phase1Score = scorePhase1(
              product,
              category,
              categoryCounts,
              state.phase1Candidates.length,
            );

            seenPids.add(product.id);
            categoryCounts.set(
              category,
              (categoryCounts.get(category) ?? 0) + 1,
            );

            state.phase1Candidates.push({
              pid: product.id,
              nameEn: product.nameEn,
              sellPrice: product.sellPrice,
              categoryId: product.categoryId,
              category,
              keyword,
              listedNum: product.listedNum,
              inventory: product.warehouseInventoryNum,
              isVideo: product.isVideo,
              bigImage: product.bigImage,
              phase1Score,
            });
          }

          // If fewer than 20 results, no more pages
          if (result.products.length < 20 || page >= result.totalPages) break;
        } catch (e) {
          consecutiveFailures++;
          const msg = `[phase1] Search failed: keyword="${keyword}" sort=${sortLabel} page=${page}: ${e}`;
          console.warn(msg);
          state.errors.push(msg);

          if (consecutiveFailures >= BACKOFF_THRESHOLD) {
            console.warn(`[phase1] ${consecutiveFailures} consecutive failures, backing off for ${BACKOFF_COOLDOWN} calls`);
            backoffRemaining = BACKOFF_COOLDOWN;
          }
          break; // skip remaining pages for this sort order
        }
      }
    }

    state.phase1KeywordsCompleted.push(keyword);
    saveRunState(state);
    console.log(
      `[phase1]   "${keyword}" done. Total candidates: ${state.phase1Candidates.length}`,
    );
  }

  state.phase1Complete = true;
  saveRunState(state);

  // Print category distribution
  console.log(`\n[phase1] Complete. ${state.phase1Candidates.length} candidates across ${categoryCounts.size} categories:`);
  for (const [cat, count] of [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(15)} ${count}`);
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Deep Evaluation
// ---------------------------------------------------------------------------

function scorePhase2(
  phase1Score: number,
  variant: CJProductVariant,
  freight: CJFreightOption,
  product: CJProduct,
  imageCount: number,
): number {
  let score = 0;

  // Phase 1 score carried (40 pts): scale from 0-100 to 0-40
  score += (phase1Score / 100) * 40;

  // Markup potential (25 pts): suggestedRetail / wholesaleCost ratio
  const costUsd = variant.variantSellPrice;
  const sugRetailUsd = variant.variantSugSellPrice || costUsd * 2;
  if (costUsd > 0) {
    const markupRatio = sugRetailUsd / costUsd;
    // Ratio 2x = 15 pts, 3x = 20 pts, 4x+ = 25 pts
    score += Math.min(25, (markupRatio - 1) * 8.33);
  }

  // Shipping efficiency (15 pts): productCost / (productCost + shippingCost)
  const shippingUsd = freight.logisticPrice;
  const totalUsd = costUsd + shippingUsd;
  if (totalUsd > 0) {
    const efficiency = costUsd / totalUsd;
    score += efficiency * 15;
  }

  // Image quality (10 pts): min(10, imageCount * 2)
  score += Math.min(10, imageCount * 2);

  // Margin score (10 pts): (sugRetail - totalCost) / sugRetail
  const totalCostUsd = costUsd + shippingUsd;
  if (sugRetailUsd > 0) {
    const margin = Math.max(0, (sugRetailUsd - totalCostUsd) / sugRetailUsd);
    score += margin * 10;
  }

  return Math.round(score * 100) / 100;
}

/** Pick variant with best markup-to-weight ratio, not just variants[0]. */
function selectBestVariant(variants: CJProductVariant[]): CJProductVariant | null {
  if (!variants.length) return null;
  if (variants.length === 1) return variants[0];

  let best = variants[0];
  let bestScore = -1;

  for (const v of variants) {
    const markup = v.variantSugSellPrice > 0
      ? v.variantSugSellPrice / Math.max(0.01, v.variantSellPrice)
      : 1;
    const weight = Math.max(0.01, v.variantWeight);
    const score = markup / weight;
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }

  return best;
}

export async function runPhase2(
  state: SmartSourceRunState,
  maxDetail: number,
): Promise<void> {
  if (state.phase2Complete) {
    console.log("[phase2] Already complete, skipping.");
    return;
  }

  const cj = getCJClient();

  // Sort Phase 1 candidates by score descending, take top `maxDetail`
  const sorted = [...state.phase1Candidates].sort(
    (a, b) => b.phase1Score - a.phase1Score,
  );
  const toEvaluate = sorted.slice(0, maxDetail);

  const processedSet = new Set(state.phase2ProcessedPids);
  const remaining = toEvaluate.filter((c) => !processedSet.has(c.pid));

  console.log(
    `[phase2] ${remaining.length} candidates to evaluate (${state.phase2Candidates.length} already done)`,
  );

  let consecutiveFailures = 0;
  let backoffRemaining = 0;
  let processed = 0;

  for (const candidate of remaining) {
    processed++;
    const delayMs = backoffRemaining > 0 ? BACKOFF_DELAY_MS : CJ_DELAY_MS;
    if (backoffRemaining > 0) backoffRemaining--;

    if (processed % 50 === 0) {
      console.log(
        `[phase2] Progress: ${processed}/${remaining.length} (${state.phase2Candidates.length} viable)`,
      );
    }

    try {
      // 1. Get product details
      await sleep(delayMs);
      let fullProduct: CJProduct;
      try {
        fullProduct = await cj.getProduct({ pid: candidate.pid });
      } catch (e) {
        state.phase2ProcessedPids.push(candidate.pid);
        consecutiveFailures++;
        if (consecutiveFailures >= BACKOFF_THRESHOLD) {
          backoffRemaining = BACKOFF_COOLDOWN;
        }
        continue;
      }
      consecutiveFailures = 0;

      const variants = fullProduct.variants ?? [];
      const variant = selectBestVariant(variants);
      if (!variant) {
        state.phase2ProcessedPids.push(candidate.pid);
        continue;
      }

      // 2. Get inventory by product
      await sleep(delayMs);
      let inventoryData;
      try {
        inventoryData = await cj.getInventoryByProduct(candidate.pid);
      } catch {
        state.phase2ProcessedPids.push(candidate.pid);
        consecutiveFailures++;
        if (consecutiveFailures >= BACKOFF_THRESHOLD) {
          backoffRemaining = BACKOFF_COOLDOWN;
        }
        continue;
      }
      consecutiveFailures = 0;

      // Check variant-level inventory
      const variantInv = inventoryData.variantInventories?.find(
        (vi) => vi.vid === variant.vid,
      );
      const variantStock = variantInv
        ? variantInv.inventory.reduce((sum, i) => sum + i.totalInventory, 0)
        : 0;

      if (variantStock < 1) {
        // Try overall product inventory
        const totalStock = inventoryData.inventories?.reduce(
          (sum, i) => sum + i.totalInventoryNum,
          0,
        ) ?? 0;
        if (totalStock < 1) {
          state.phase2ProcessedPids.push(candidate.pid);
          continue;
        }
      }

      // Find from-country
      const fromCountry =
        inventoryData.inventories?.find((i) => i.totalInventoryNum > 0)
          ?.countryCode ?? "CN";

      // 3. Calculate freight
      await sleep(delayMs);
      let freightOptions: CJFreightOption[];
      try {
        freightOptions = await cj.calculateFreight({
          startCountryCode: fromCountry,
          endCountryCode: "US",
          products: [{ vid: variant.vid, quantity: 1 }],
        });
      } catch {
        state.phase2ProcessedPids.push(candidate.pid);
        consecutiveFailures++;
        if (consecutiveFailures >= BACKOFF_THRESHOLD) {
          backoffRemaining = BACKOFF_COOLDOWN;
        }
        continue;
      }
      consecutiveFailures = 0;

      if (!freightOptions.length) {
        state.phase2ProcessedPids.push(candidate.pid);
        continue;
      }

      const cheapest = freightOptions.sort(
        (a, b) => a.logisticPrice - b.logisticPrice,
      )[0];

      const images = fullProduct.productImageSet?.length
        ? fullProduct.productImageSet
        : [candidate.bigImage].filter(Boolean);

      const costCents = Math.round(variant.variantSellPrice * 100);
      const shippingCents = Math.round(cheapest.logisticPrice * 100);
      const totalCostCents = costCents + shippingCents;
      const suggestedRetailCents = Math.round(
        (variant.variantSugSellPrice || variant.variantSellPrice * 2) * 100,
      );

      // Financial model: reserve guarantees profit after Stripe fees,
      // buyer premium, and CJ price fluctuation risk.
      // Starting bid uses penny-staggered auction psychology.
      const pricing = computePricing({
        productCostCents: costCents,
        shippingCostCents: shippingCents,
        buyerPremiumRate: state.buyerPremiumRate,
        suggestedRetailCents,
      });
      const startingBidCents = pricing.startingBidCents;
      const reserveCents = pricing.reserveCents;

      const phase2Score = scorePhase2(
        candidate.phase1Score,
        variant,
        cheapest,
        fullProduct,
        images.length,
      );

      state.phase2Candidates.push({
        pid: candidate.pid,
        nameEn: candidate.nameEn,
        category: candidate.category,
        keyword: candidate.keyword,
        phase1Score: candidate.phase1Score,
        productName: fullProduct.productNameEn || candidate.nameEn,
        variantName: variant.variantNameEn || "",
        vid: variant.vid,
        costCents,
        shippingCents,
        totalCostCents,
        logisticName: cheapest.logisticName,
        fromCountry,
        images,
        description: fullProduct.description || candidate.nameEn,
        suggestedRetailCents,
        variantWeight: variant.variantWeight,
        imageCount: images.length,
        phase2Score,
        startingBidCents,
        reserveCents,
      });
    } catch (e) {
      const msg = `[phase2] Unexpected error for pid=${candidate.pid}: ${e}`;
      console.warn(msg);
      state.errors.push(msg);
    }

    state.phase2ProcessedPids.push(candidate.pid);

    // Save progress every 10 products
    if (state.phase2ProcessedPids.length % 10 === 0) {
      saveRunState(state);
    }
  }

  state.phase2Complete = true;
  saveRunState(state);

  console.log(
    `\n[phase2] Complete. ${state.phase2Candidates.length} fully evaluated candidates.`,
  );

  // Print score distribution
  const scores = state.phase2Candidates.map((c) => c.phase2Score);
  if (scores.length > 0) {
    scores.sort((a, b) => b - a);
    console.log(`  Top score:    ${scores[0]}`);
    console.log(`  Median score: ${scores[Math.floor(scores.length / 2)]}`);
    console.log(`  Bottom score: ${scores[scores.length - 1]}`);
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Create Auctions
// ---------------------------------------------------------------------------

function buildAuctionConfigs(numAuctions: number): AuctionConfig[] {
  // Auctions open Wed Feb 11 6pm PST, close Thu/Fri/Sat 8pm PST
  // PST = UTC-8
  const configs: AuctionConfig[] = [];

  // Open: Wed Feb 11, 2026 6:00 PM PST = Feb 12 02:00 UTC
  const openDate = new Date("2026-02-12T02:00:00.000Z");

  const titles = [
    "Thursday Night Deals",
    "Friday Night Deals",
    "Valentine's Day Special",
  ];

  // Close dates: Thu/Fri/Sat at 8pm PST = next day 04:00 UTC
  const closeDates = [
    new Date("2026-02-13T04:00:00.000Z"), // Thu Feb 12 8pm PST
    new Date("2026-02-14T04:00:00.000Z"), // Fri Feb 13 8pm PST
    new Date("2026-02-15T04:00:00.000Z"), // Sat Feb 14 8pm PST
  ];

  for (let i = 0; i < numAuctions && i < 3; i++) {
    configs.push({
      title: titles[i] || `Auction ${i + 1}`,
      openDate: openDate.toISOString(),
      closingDate: closeDates[i].toISOString(),
    });
  }

  return configs;
}

/**
 * Distribute candidates across auctions using stratified round-robin.
 * Sort by score, assign round-robin so each auction gets equal mix of
 * high/medium/low scoring items + category diversity.
 */
function distributeItems(
  candidates: Phase2Candidate[],
  numAuctions: number,
  itemsPerAuction: number,
): Phase2Candidate[][] {
  const totalNeeded = numAuctions * itemsPerAuction;
  const sorted = [...candidates].sort((a, b) => b.phase2Score - a.phase2Score);
  const selected = sorted.slice(0, totalNeeded);

  const buckets: Phase2Candidate[][] = Array.from(
    { length: numAuctions },
    () => [],
  );

  // Round-robin assignment
  for (let i = 0; i < selected.length; i++) {
    const bucketIdx = i % numAuctions;
    buckets[bucketIdx].push(selected[i]);
  }

  return buckets;
}

export async function runPhase3(
  state: SmartSourceRunState,
  options: SmartSourceOptions,
): Promise<void> {
  if (state.phase3Complete) {
    console.log("[phase3] Already complete, skipping.");
    return;
  }

  if (options.dryRun) {
    console.log("[phase3] DRY RUN — skipping auction creation.");
    printDryRunSummary(state, options);
    state.phase3Complete = true;
    saveRunState(state);
    return;
  }

  const { numAuctions, itemsPerAuction, publish } = options;
  const auctionConfigs = buildAuctionConfigs(numAuctions);
  const buckets = distributeItems(
    state.phase2Candidates,
    numAuctions,
    itemsPerAuction,
  );

  const bastaClient = getManagementApiClient();
  const accountId = getAccountId();
  const apiKey = process.env.API_KEY?.trim() ?? "";
  const gqlUrl = "https://management.api.basta.app/graphql";
  const gqlHeaders = {
    "Content-Type": "application/json",
    "x-account-id": accountId,
    "x-api-key": apiKey,
  };

  for (let aIdx = 0; aIdx < auctionConfigs.length; aIdx++) {
    const config = auctionConfigs[aIdx];
    const items = buckets[aIdx];

    if (!items.length) {
      console.log(`[phase3] Auction ${aIdx + 1} has no items, skipping.`);
      continue;
    }

    console.log(
      `\n[phase3] Creating Auction ${aIdx + 1}/${auctionConfigs.length}: "${config.title}" (${items.length} items)`,
    );

    // Create sale
    let saleId: string;
    try {
      const saleResult = await bastaClient.mutation({
        createSale: {
          __args: {
            accountId,
            input: {
              title: config.title,
              description: `${config.title} — ${items.length} items from Placer Auctions`,
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
    } catch (e) {
      const msg = `[phase3] Failed to create sale "${config.title}": ${e}`;
      console.error(msg);
      state.errors.push(msg);
      continue;
    }

    console.log(`[phase3]   Sale created: ${saleId}`);
    state.saleIds.push(saleId);

    // Attach registration policy
    try {
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
        console.log(`[phase3]   Attached shipping policy: ${policyId}`);
      }
    } catch (e) {
      console.warn("[phase3]   Failed to attach registration policy (non-blocking):", e);
    }

    // Create items
    let itemsCreated = 0;
    const lotIds: Array<{ lotId: string; candidate: Phase2Candidate }> = [];

    for (let i = 0; i < items.length; i++) {
      const c = items[i];

      // Save to DB first
      let lotId: string;
      try {
        lotId = await insertDropshipLot({
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
      } catch (e) {
        console.warn(`[phase3]   Failed to insert lot for ${c.productName}: ${e}`);
        continue;
      }

      // Create Basta item
      let itemId: string | null = null;
      let retries = 0;
      while (retries < 2) {
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
                  openDate: config.openDate,
                  closingDate: config.closingDate,
                  allowedBidTypes: ["MAX", "NORMAL"],
                  ItemNumber: i + 1,
                },
              },
              id: true,
              title: true,
            },
          });

          itemId = itemResult.createItemForSale?.id as string;
          if (!itemId) throw new Error("No item ID returned");
          break;
        } catch (e) {
          retries++;
          if (retries >= 2) {
            console.warn(
              `[phase3]   Failed to create item (${retries} attempts): ${c.productName}: ${e}`,
            );
            await updateDropshipLot(lotId, {
              status: "CANCELLED",
              error_message: `Basta item creation failed: ${e}`,
            });
          } else {
            await sleep(2000);
          }
        }
      }

      if (!itemId) continue;

      // Upload images (non-blocking)
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
          if (!uploadData?.uploadUrl) continue;

          const imgResponse = await fetch(c.images[j]);
          if (!imgResponse.ok) continue;
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

          const putHeaders: Record<string, string> = {
            "Content-Type": "image/jpeg",
          };
          for (const h of uploadData.headers ?? []) {
            if (h.key !== "Host") putHeaders[h.key] = h.value;
          }

          await fetch(uploadData.uploadUrl, {
            method: "PUT",
            headers: putHeaders,
            body: imgBuffer,
          });
        } catch {
          // Image upload failure is non-blocking
        }
      }

      await updateDropshipLot(lotId, {
        basta_sale_id: saleId,
        basta_item_id: itemId,
        status: "LISTED",
      });

      lotIds.push({ lotId, candidate: c });
      itemsCreated++;

      if (itemsCreated % 25 === 0) {
        console.log(
          `[phase3]   Progress: ${itemsCreated}/${items.length} items created`,
        );
      }
    }

    console.log(`[phase3]   ${itemsCreated} items created for "${config.title}"`);

    // Publish
    if (publish && itemsCreated > 0) {
      try {
        await bastaClient.mutation({
          publishSale: {
            __args: { accountId, input: { saleId } },
            id: true,
            status: true,
          },
        });

        for (const { lotId } of lotIds) {
          await updateDropshipLot(lotId, { status: "PUBLISHED" });
        }
        console.log(`[phase3]   Sale published!`);
      } catch (e) {
        console.error(`[phase3]   Failed to publish sale: ${e}`);
        state.errors.push(`Failed to publish sale ${saleId}: ${e}`);
      }
    }

    saveRunState(state);
  }

  state.phase3Complete = true;
  saveRunState(state);

  console.log(`\n[phase3] Complete. Created ${state.saleIds.length} auctions.`);
}

// ---------------------------------------------------------------------------
// Dry run summary
// ---------------------------------------------------------------------------

function printDryRunSummary(
  state: SmartSourceRunState,
  options: SmartSourceOptions,
): void {
  const { numAuctions, itemsPerAuction } = options;
  const buckets = distributeItems(
    state.phase2Candidates,
    numAuctions,
    itemsPerAuction,
  );
  const configs = buildAuctionConfigs(numAuctions);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("                 SMART SOURCE — DRY RUN");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Phase 1 candidates:  ${state.phase1Candidates.length}`);
  console.log(`Phase 2 evaluated:   ${state.phase2Candidates.length}`);
  console.log(`Errors:              ${state.errors.length}\n`);

  // Category distribution
  const catCounts = new Map<string, number>();
  for (const c of state.phase2Candidates) {
    catCounts.set(c.category, (catCounts.get(c.category) ?? 0) + 1);
  }
  console.log("Category distribution:");
  for (const [cat, count] of [...catCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(15)} ${count}`);
  }

  // Score distribution
  const scores = state.phase2Candidates
    .map((c) => c.phase2Score)
    .sort((a, b) => b - a);
  if (scores.length > 0) {
    console.log(`\nScore distribution:`);
    console.log(`  Top:     ${scores[0].toFixed(1)}`);
    console.log(`  P25:     ${scores[Math.floor(scores.length * 0.25)].toFixed(1)}`);
    console.log(`  Median:  ${scores[Math.floor(scores.length * 0.5)].toFixed(1)}`);
    console.log(`  P75:     ${scores[Math.floor(scores.length * 0.75)].toFixed(1)}`);
    console.log(`  Bottom:  ${scores[scores.length - 1].toFixed(1)}`);
  }

  // Cost distribution
  const costs = state.phase2Candidates
    .map((c) => c.totalCostCents / 100)
    .sort((a, b) => a - b);
  if (costs.length > 0) {
    console.log(`\nCost distribution (USD):`);
    console.log(`  Min:     $${costs[0].toFixed(2)}`);
    console.log(`  Median:  $${costs[Math.floor(costs.length / 2)].toFixed(2)}`);
    console.log(`  Max:     $${costs[costs.length - 1].toFixed(2)}`);
    const avgCost = costs.reduce((s, c) => s + c, 0) / costs.length;
    console.log(`  Average: $${avgCost.toFixed(2)}`);
  }

  // Auction distribution
  console.log(`\nAuction plan (${numAuctions} auctions):`);
  for (let i = 0; i < configs.length; i++) {
    const items = buckets[i] || [];
    const catBreakdown = new Map<string, number>();
    let totalCost = 0;
    for (const item of items) {
      catBreakdown.set(item.category, (catBreakdown.get(item.category) ?? 0) + 1);
      totalCost += item.totalCostCents;
    }
    console.log(`\n  Auction ${i + 1}: "${configs[i].title}"`);
    console.log(`    Items:   ${items.length}`);
    console.log(`    Opens:   ${configs[i].openDate}`);
    console.log(`    Closes:  ${configs[i].closingDate}`);
    console.log(`    Total cost: $${(totalCost / 100).toFixed(2)}`);
    if (items.length > 0) {
      const avgScore =
        items.reduce((s, item) => s + item.phase2Score, 0) / items.length;
      console.log(`    Avg score: ${avgScore.toFixed(1)}`);
    }
    console.log(`    Categories: ${[...catBreakdown.entries()].map(([k, v]) => `${k}(${v})`).join(", ")}`);
  }

  // Top 10 items
  const topItems = [...state.phase2Candidates]
    .sort((a, b) => b.phase2Score - a.phase2Score)
    .slice(0, 10);
  console.log(`\nTop 10 items by score:`);
  for (const item of topItems) {
    console.log(
      `  ${item.phase2Score.toFixed(1).padStart(5)} | $${(item.totalCostCents / 100).toFixed(2).padStart(7)} | ${item.category.padEnd(12)} | ${item.productName.slice(0, 50)}`,
    );
  }

  // Pricing analysis — show reserve/starting bid for a sample
  if (topItems.length > 0) {
    printPricingTable(
      topItems.map((item) => ({
        name: item.productName,
        productCostCents: item.costCents,
        shippingCostCents: item.shippingCents,
        suggestedRetailCents: item.suggestedRetailCents,
      })),
      state.buyerPremiumRate,
    );
  }

  // Starting bid distribution — verify staggering
  const startingBids = state.phase2Candidates.map((c) => c.startingBidCents);
  if (startingBids.length > 0) {
    const uniqueBids = new Set(startingBids).size;
    const roundDollarCount = startingBids.filter((b) => b % 100 === 0).length;
    console.log(`\nStarting bid stagger analysis:`);
    console.log(`  Unique starting bids:  ${uniqueBids} / ${startingBids.length}`);
    console.log(`  Round-dollar bids:     ${roundDollarCount} (${((roundDollarCount / startingBids.length) * 100).toFixed(1)}%)`);
    console.log(`  Min: $${(Math.min(...startingBids) / 100).toFixed(2)}, Max: $${(Math.max(...startingBids) / 100).toFixed(2)}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`Run ID: ${state.runId}`);
  console.log(`Resume: pnpm pipeline:smart-source --resume ${state.runId} --publish`);
  console.log("═══════════════════════════════════════════════════════════");
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runSmartSource(options: SmartSourceOptions): Promise<SmartSourceRunState> {
  // Initialize or resume state
  let state: SmartSourceRunState;

  if (options.resumeRunId) {
    const loaded = loadRunState(options.resumeRunId);
    if (!loaded) {
      throw new Error(`No saved run found for ID: ${options.resumeRunId}`);
    }
    state = loaded;
    console.log(`[smart-source] Resuming run ${state.runId} (started ${state.startedAt})`);
    console.log(`  Phase 1: ${state.phase1Complete ? "complete" : `${state.phase1KeywordsCompleted.length} keywords done`}`);
    console.log(`  Phase 2: ${state.phase2Complete ? "complete" : `${state.phase2ProcessedPids.length} products done`}`);
    console.log(`  Phase 3: ${state.phase3Complete ? "complete" : "pending"}`);
  } else {
    const runId = generateRunId();
    state = {
      runId,
      startedAt: new Date().toISOString(),
      buyerPremiumRate: options.buyerPremiumRate,
      phase1Complete: false,
      phase2Complete: false,
      phase3Complete: false,
      phase1Candidates: [],
      phase2Candidates: [],
      phase1KeywordsCompleted: [],
      phase2ProcessedPids: [],
      saleIds: [],
      errors: [],
    };
    saveRunState(state);
    console.log(`[smart-source] Starting new run: ${runId}`);
  }

  // Phase 1: Wide Search
  console.log("\n══════════════════════════════════════════");
  console.log("  PHASE 1: Wide Search");
  console.log("══════════════════════════════════════════\n");
  await runPhase1(state);

  // Phase 2: Deep Evaluation
  console.log("\n══════════════════════════════════════════");
  console.log("  PHASE 2: Deep Evaluation");
  console.log("══════════════════════════════════════════\n");
  await runPhase2(state, options.maxDetail);

  // Phase 3: Create Auctions
  console.log("\n══════════════════════════════════════════");
  console.log("  PHASE 3: Create Auctions");
  console.log("══════════════════════════════════════════\n");
  await runPhase3(state, options);

  // Final summary
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("              SMART SOURCE — COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Run ID:              ${state.runId}`);
  console.log(`Phase 1 candidates:  ${state.phase1Candidates.length}`);
  console.log(`Phase 2 evaluated:   ${state.phase2Candidates.length}`);
  console.log(`Auctions created:    ${state.saleIds.length}`);
  console.log(`Errors:              ${state.errors.length}`);

  if (state.saleIds.length > 0) {
    console.log(`\nSale IDs:`);
    for (const saleId of state.saleIds) {
      console.log(`  ${saleId}`);
      console.log(`  Dashboard: https://dashboard.basta.app/sales/${saleId}`);
    }
  }

  if (state.errors.length > 0) {
    console.log(`\nErrors (${state.errors.length}):`);
    for (const err of state.errors.slice(0, 10)) {
      console.log(`  ${err}`);
    }
    if (state.errors.length > 10) {
      console.log(`  ... and ${state.errors.length - 10} more`);
    }
  }

  console.log("═══════════════════════════════════════════════════════════");

  return state;
}
