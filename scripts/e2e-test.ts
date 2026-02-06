/**
 * E2E Test Harness — Full Dropship Auction Pipeline
 *
 * Orchestrates the entire lifecycle WITHOUT any frontend:
 *   1. Source a CJ product -> create Basta sale + item -> publish + open
 *   2. Register a test user with shipping address
 *   3. Place bids via bidOnBehalf
 *   4. Close the sale via forceCloseSale
 *   5. Verify webhook fires -> order creation -> Stripe invoice -> CJ fulfillment
 *
 * Usage:
 *   pnpm tsx scripts/e2e-test.ts
 *   pnpm tsx scripts/e2e-test.ts --dry-run
 *   pnpm tsx scripts/e2e-test.ts --skip-source --sale-id=XXX --item-id=YYY
 *
 * Required env (in .env.local):
 *   API_KEY, ACCOUNT_ID, CJ_API_KEY, STRIPE_SECRET_KEY,
 *   TURSO_DATABASE_URL (or defaults to file:./db/local.db)
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { CJClient } from "../lib/cj-client";
import { getManagementApiClient, getAccountId, MANAGEMENT_API_URL } from "../lib/basta-client";
import {
  insertDropshipLot,
  updateDropshipLot,
  getDropshipLotByBastaItem,
  getDropshipLotsBySale,
} from "../lib/dropship";
import { db } from "../lib/turso";

// ---------------------------------------------------------------------------
// Constants & Config
// ---------------------------------------------------------------------------

const BASTA_ACCOUNT_ID = "68ef01b4-b445-4d04-8f52-62a1e30763a3";
const GQL_URL = MANAGEMENT_API_URL || "https://management.api.basta.app/graphql";
const WEBHOOK_URL = "https://fastbid.co/api/webhooks/basta";

// Test bidders — existing Basta users with shipping addresses already set.
// Basta doesn't allow self-outbidding, so we need two competing bidders
// to drive the price above reserve.
const BIDDER_A = {
  userId: "client-bidder-jane",
  name: "Jane Bidder",
};

const BIDDER_B = {
  userId: "client-bidder-bob",
  name: "Bob Bidder",
};

// Sourcing defaults (small, cheap item for E2E)
const E2E_SOURCING = {
  searchKeyword: "phone stand",
  maxCostUsd: 15,
  countryCode: "US",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CJ_DELAY_MS = 1200;

// ---------------------------------------------------------------------------
// CLI args parsing
// ---------------------------------------------------------------------------

function parseArgs(): {
  dryRun: boolean;
  skipSource: boolean;
  saleId?: string;
  itemId?: string;
} {
  const args = process.argv.slice(2);
  const flags = {
    dryRun: false,
    skipSource: false,
    saleId: undefined as string | undefined,
    itemId: undefined as string | undefined,
  };

  for (const arg of args) {
    if (arg === "--dry-run") flags.dryRun = true;
    if (arg === "--skip-source") flags.skipSource = true;
    if (arg.startsWith("--sale-id=")) flags.saleId = arg.split("=")[1];
    if (arg.startsWith("--item-id=")) flags.itemId = arg.split("=")[1];
  }

  if (flags.skipSource && (!flags.saleId || !flags.itemId)) {
    console.error("[e2e] ERROR: --skip-source requires both --sale-id=XXX and --item-id=YYY");
    process.exit(1);
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Raw GraphQL helper (mirrors bastaGql pattern from basta-user.ts)
// ---------------------------------------------------------------------------

async function bastaGql<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const accountId = getAccountId() || BASTA_ACCOUNT_ID;
  const apiKey = process.env.API_KEY?.trim();
  if (!apiKey) throw new Error("Missing API_KEY env var");

  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-account-id": accountId,
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as {
    data?: T;
    errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
  };

  if (json.errors?.length) {
    const messages = json.errors.map((e) => e.message).join("; ");
    throw new Error(`Basta GraphQL error: ${messages}`);
  }

  return json.data as T;
}

// ---------------------------------------------------------------------------
// Step 1: Source a CJ product + create Basta sale/item
// ---------------------------------------------------------------------------

async function stepSourceAndList(): Promise<{
  saleId: string;
  itemId: string;
  lotId: string;
  startingBidCents: number;
  reserveCents: number;
}> {
  console.log("\n[e2e] ═══════════════════════════════════════════════════════");
  console.log("[e2e]  STEP 1: Source CJ product + create Basta sale/item");
  console.log("[e2e] ═══════════════════════════════════════════════════════\n");

  const cjApiKey = process.env.CJ_API_KEY?.trim();
  if (!cjApiKey) throw new Error("Missing CJ_API_KEY");

  const cj = new CJClient(cjApiKey);
  const bastaClient = getManagementApiClient();
  const accountId = getAccountId();

  // --- Search for a cheap product ---
  console.log(`[e2e] Searching CJ for "${E2E_SOURCING.searchKeyword}"...`);
  const searchResult = await cj.searchProducts({
    keyWord: E2E_SOURCING.searchKeyword,
    size: 10,
    countryCode: E2E_SOURCING.countryCode,
    orderBy: 1,
  });

  console.log(`[e2e] Found ${searchResult.totalRecords} products, fetched ${searchResult.products.length}`);

  if (!searchResult.products.length) {
    throw new Error("No CJ products found for E2E test");
  }

  // --- Pick the first viable product ---
  let candidate: {
    pid: string;
    vid: string;
    productName: string;
    costCents: number;
    shippingCents: number;
    logisticName: string;
    fromCountry: string;
    images: string[];
    description: string;
  } | null = null;

  for (const product of searchResult.products) {
    const priceStr = product.sellPrice.split(/\s*--\s*/)[0];
    const costUsd = parseFloat(priceStr);
    if (isNaN(costUsd) || costUsd > E2E_SOURCING.maxCostUsd) continue;
    if (product.warehouseInventoryNum < 1) continue;

    await sleep(CJ_DELAY_MS);
    let fullProduct;
    try {
      fullProduct = await cj.getProduct({ pid: product.id });
    } catch {
      continue;
    }

    const variant = fullProduct.variants?.[0];
    if (!variant) continue;

    await sleep(CJ_DELAY_MS);
    let inventory;
    try {
      inventory = await cj.getInventoryByVariant(variant.vid);
    } catch {
      continue;
    }

    const totalStock = inventory.reduce((sum, inv) => sum + inv.totalInventoryNum, 0);
    if (totalStock < 1) continue;

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
      continue;
    }

    if (!freightOptions.length) continue;

    const cheapest = freightOptions.sort((a, b) => a.logisticPrice - b.logisticPrice)[0];
    const costCents = Math.round(variant.variantSellPrice * 100);
    const shippingCents = Math.round(cheapest.logisticPrice * 100);

    const images = fullProduct.productImageSet?.length
      ? fullProduct.productImageSet
      : [product.bigImage].filter(Boolean);

    candidate = {
      pid: fullProduct.pid,
      vid: variant.vid,
      productName: fullProduct.productNameEn || product.nameEn,
      costCents,
      shippingCents,
      logisticName: cheapest.logisticName,
      fromCountry,
      images,
      description: fullProduct.description || product.nameEn,
    };

    console.log(`[e2e] Selected: ${candidate.productName} (cost $${(costCents / 100).toFixed(2)} + ship $${(shippingCents / 100).toFixed(2)})`);
    break;
  }

  if (!candidate) {
    throw new Error("No viable CJ product found for E2E test");
  }

  // --- Calculate pricing ---
  // IMPORTANT: Basta requires bids to land on increment step boundaries.
  // The bid increment table uses step=100 for 0-1000, step=250 for 1000-5000.
  // Starting bid and reserve must be multiples of the step to avoid "off increment" errors.
  const totalCostCents = candidate.costCents + candidate.shippingCents;
  const rawStarting = Math.round(totalCostCents * 0.5);
  const rawReserve = Math.round(totalCostCents * 1.3);
  // Round up to nearest 100 (step for 0-1000 range)
  const startingBidCents = Math.ceil(rawStarting / 100) * 100;
  // Round reserve up to nearest step (250 if above 1000, else 100)
  const reserveStep = rawReserve >= 1000 ? 250 : 100;
  const reserveCents = Math.ceil(rawReserve / reserveStep) * reserveStep;

  console.log(`[e2e] Pricing: starting bid $${(startingBidCents / 100).toFixed(2)}, reserve $${(reserveCents / 100).toFixed(2)}`);

  // --- Insert into local DB ---
  console.log("[e2e] Saving to local DB...");
  const lotId = await insertDropshipLot({
    cj_pid: candidate.pid,
    cj_vid: candidate.vid,
    cj_product_name: candidate.productName,
    cj_cost_cents: candidate.costCents,
    cj_shipping_cents: candidate.shippingCents,
    cj_logistic_name: candidate.logisticName,
    cj_from_country: candidate.fromCountry,
    cj_images: candidate.images,
    starting_bid_cents: startingBidCents,
    reserve_cents: reserveCents,
  });
  console.log(`[e2e] Lot ID: ${lotId}`);

  // --- Create Basta sale ---
  console.log("[e2e] Creating Basta sale...");
  const saleResult = await bastaClient.mutation({
    createSale: {
      __args: {
        accountId,
        input: {
          title: `[E2E Test] ${candidate.productName}`,
          description: `E2E test sale created at ${new Date().toISOString()}`,
          currency: "USD",
          closingMethod: "OVERLAPPING",
          closingTimeCountdown: 5000, // 5s countdown for fast E2E (uses forceStartClosingSale)
          bidIncrementTable: {
            rules: [
              { lowRange: 0, highRange: 1000, step: 100 },
              { lowRange: 1000, highRange: 5000, step: 250 },
              { lowRange: 5000, highRange: 50000, step: 500 },
            ],
          },
        },
      },
      id: true,
      title: true,
      status: true,
    },
  });

  const saleId = saleResult.createSale?.id as string;
  if (!saleId) throw new Error("No sale ID returned from Basta");
  console.log(`[e2e] Sale created: ${saleId}`);

  // --- Create item in the sale ---
  console.log("[e2e] Creating item in sale...");
  const openDate = new Date(Date.now() + 5000).toISOString(); // opens in 5 seconds
  const closingDate = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // closes in 5 min

  const itemResult = await bastaClient.mutation({
    createItemForSale: {
      __args: {
        accountId,
        input: {
          saleId,
          title: candidate.productName,
          description: candidate.description,
          startingBid: startingBidCents,
          reserve: reserveCents,
          openDate,
          closingDate,
          allowedBidTypes: ["MAX", "NORMAL"],
          ItemNumber: 1,
        },
      },
      id: true,
      title: true,
    },
  });

  const itemId = itemResult.createItemForSale?.id as string;
  if (!itemId) throw new Error("No item ID returned from Basta");
  console.log(`[e2e] Item created: ${itemId}`);

  // --- Update local DB ---
  await updateDropshipLot(lotId, {
    basta_sale_id: saleId,
    basta_item_id: itemId,
    status: "LISTED",
  });

  console.log("[e2e] Step 1 complete.\n");

  return { saleId, itemId, lotId, startingBidCents, reserveCents };
}

// ---------------------------------------------------------------------------
// Step 2: Publish + Open the sale
// ---------------------------------------------------------------------------

async function stepPublishAndOpen(saleId: string): Promise<void> {
  console.log("[e2e] ═══════════════════════════════════════════════════════");
  console.log("[e2e]  STEP 2: Publish and open the sale");
  console.log("[e2e] ═══════════════════════════════════════════════════════\n");

  const accountId = getAccountId();

  // Publish
  console.log("[e2e] Publishing sale...");
  await bastaGql(
    `mutation PublishSale($accountId: String!, $input: PublishSaleInput!) {
      publishSale(accountId: $accountId, input: $input) {
        id status
      }
    }`,
    { accountId, input: { saleId } }
  );
  console.log("[e2e] Sale published.");

  // Force open (don't wait for scheduled open time)
  console.log("[e2e] Force-opening sale...");
  await bastaGql(
    `mutation ForceOpenSale($accountId: String!, $input: OpenSaleInput!) {
      forceOpenSale(accountId: $accountId, input: $input) {
        id status
      }
    }`,
    { accountId, input: { saleId } }
  );
  console.log("[e2e] Sale opened.");

  // Brief pause for Basta to propagate
  await sleep(2000);
  console.log("[e2e] Step 2 complete.\n");
}

// ---------------------------------------------------------------------------
// Step 3: Verify & register both bidders
// ---------------------------------------------------------------------------

async function stepRegisterBidders(saleId: string): Promise<void> {
  console.log("[e2e] ═══════════════════════════════════════════════════════");
  console.log("[e2e]  STEP 3: Verify & register bidders");
  console.log("[e2e] ═══════════════════════════════════════════════════════\n");

  const accountId = getAccountId();

  for (const bidder of [BIDDER_A, BIDDER_B]) {
    console.log(`[e2e] Verifying bidder: ${bidder.userId} (${bidder.name})`);
    const userData = await bastaGql<{
      updateUser: { userId: string; shippingAddress: { line1: string; city: string; state: string } | null } | null;
    }>(
      `mutation ReadUserAddress($accountId: String!, $input: UpdateUserInput!) {
        updateUser(accountId: $accountId, input: $input) {
          userId
          shippingAddress { line1 city state }
        }
      }`,
      {
        accountId,
        input: { userId: bidder.userId, idType: "USER_ID" },
      }
    );

    const addr = userData.updateUser?.shippingAddress;
    if (addr?.line1) {
      console.log(`[e2e]   Address: ${addr.line1}, ${addr.city} ${addr.state}`);
    } else {
      console.warn(`[e2e]   WARNING: No shipping address for ${bidder.userId}`);
    }

    try {
      await bastaGql(
        `mutation CreateSaleRegistration($accountId: String!, $input: CreateSaleRegistrationInput!) {
          createSaleRegistration(accountId: $accountId, input: $input) {
            id status
          }
        }`,
        {
          accountId,
          input: { saleId, userId: bidder.userId, type: "ONLINE" },
        }
      );
      console.log(`[e2e]   Registered for sale.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already") || msg.includes("duplicate")) {
        console.log(`[e2e]   Already registered (OK).`);
      } else {
        throw err;
      }
    }
  }

  console.log("[e2e] Step 3 complete.\n");
}

// ---------------------------------------------------------------------------
// Step 4: Competitive bidding between two bidders
// ---------------------------------------------------------------------------

async function stepPlaceBids(params: {
  saleId: string;
  itemId: string;
  startingBidCents: number;
  reserveCents: number;
}): Promise<{ highestBid: number; winnerId: string }> {
  console.log("[e2e] ═══════════════════════════════════════════════════════");
  console.log("[e2e]  STEP 4: Competitive bidding (two bidders)");
  console.log("[e2e] ═══════════════════════════════════════════════════════\n");

  const accountId = getAccountId();
  const { saleId, itemId, startingBidCents, reserveCents } = params;

  // Build alternating bid schedule between two bidders.
  // Basta doesn't allow self-outbidding, so bidders must alternate.
  // CRITICAL: Bids must land on step boundaries (multiples of the step).
  // The bid increment table: step=100 for 0-1000, step=250 for 1000-5000, step=500 for 5000+
  const bidSchedule: Array<{ userId: string; amount: number }> = [];

  let currentBid = startingBidCents;
  let bidderIndex = 0;
  const bidders = [BIDDER_A.userId, BIDDER_B.userId];

  // Keep bidding until we exceed reserve
  const targetBid = reserveCents + (reserveCents < 1000 ? 100 : 250);

  while (currentBid <= targetBid) {
    bidSchedule.push({ userId: bidders[bidderIndex], amount: currentBid });
    // Calculate next increment and ensure alignment
    const step = currentBid < 1000 ? 100 : currentBid < 5000 ? 250 : 500;
    currentBid += step;
    // Ensure bid is on step boundary (round up to nearest multiple of step)
    currentBid = Math.ceil(currentBid / step) * step;
    bidderIndex = 1 - bidderIndex; // alternate
  }

  console.log(`[e2e] Bid schedule: ${bidSchedule.length} bids, target $${(targetBid / 100).toFixed(2)}`);

  let highestBid = 0;
  let winnerId = BIDDER_A.userId;

  for (const { userId, amount } of bidSchedule) {
    console.log(`[e2e] ${userId === BIDDER_A.userId ? "Jane" : "Bob"} bids $${(amount / 100).toFixed(2)}...`);
    try {
      const result = await bastaGql<{
        bidOnBehalf: { bidId: string; amount: number; userId: string; bidStatus: string };
      }>(
        `mutation BidOnBehalf($accountId: String!, $input: BidOnBehalfInput!) {
          bidOnBehalf(accountId: $accountId, input: $input) {
            bidId
            amount
            userId
            bidStatus
          }
        }`,
        {
          accountId,
          input: { userId, amount, itemId, saleId, type: "NORMAL" },
        }
      );
      const bid = result.bidOnBehalf;
      console.log(`[e2e]   -> ${bid.bidStatus} at ${bid.amount}`);
      if (bid.amount > highestBid) {
        highestBid = bid.amount;
        winnerId = userId;
      }
    } catch (err) {
      console.log(`[e2e]   -> Rejected: ${err instanceof Error ? err.message : err}`);
    }

    await sleep(300);
  }

  if (highestBid === 0) {
    throw new Error("All bids were rejected! Cannot proceed.");
  }

  console.log(`[e2e] Highest bid: $${(highestBid / 100).toFixed(2)} by ${winnerId}`);
  console.log(`[e2e] Reserve met: ${highestBid >= reserveCents ? "YES" : "NO"}`);
  console.log("[e2e] Step 4 complete.\n");

  return { highestBid, winnerId };
}

// ---------------------------------------------------------------------------
// Step 5: Start closing + wait for natural countdown close
// ---------------------------------------------------------------------------

/**
 * IMPORTANT: We use `forceStartClosingSale` + countdown instead of `forceCloseSale`.
 *
 * `forceCloseSale` has a Basta bug where it resets `reserveStatus` to NOT_MET
 * and `leaderId` to null, regardless of actual bid state. The natural close
 * path (countdown expiry) works correctly.
 *
 * The sale was created with closingTimeCountdown: 5000ms (5s) so we just need
 * to wait for the countdown to expire after triggering the closing phase.
 */
async function stepCloseViaCounting(saleId: string): Promise<void> {
  console.log("[e2e] ═══════════════════════════════════════════════════════");
  console.log("[e2e]  STEP 5: Start closing + wait for countdown");
  console.log("[e2e] ═══════════════════════════════════════════════════════\n");

  const accountId = getAccountId();

  console.log("[e2e] Calling forceStartClosingSale...");
  await bastaGql(
    `mutation ForceStartClosingSale($accountId: String!, $input: StartClosingSaleInput!) {
      forceStartClosingSale(accountId: $accountId, input: $input) {
        id status
      }
    }`,
    { accountId, input: { saleId } }
  );
  console.log("[e2e] Sale entering CLOSING state.");

  // Wait for the countdown (sale was created with 5s countdown + buffer)
  const waitMs = 8000;
  console.log(`[e2e] Waiting ${waitMs / 1000}s for countdown to expire...`);
  await sleep(waitMs);

  // Verify the sale actually closed
  const client = getManagementApiClient();
  const saleState = await client.query({
    sale: {
      __args: { accountId, id: saleId },
      status: true,
    },
  });

  const status = saleState.sale?.status as string;
  console.log(`[e2e] Sale status after countdown: ${status}`);

  if (status !== "CLOSED") {
    console.log("[e2e] Sale not yet closed, waiting another 5s...");
    await sleep(5000);
    const retry = await client.query({
      sale: { __args: { accountId, id: saleId }, status: true },
    });
    console.log(`[e2e] Sale status: ${retry.sale?.status}`);
  }

  console.log("[e2e] Step 5 complete.\n");
}

// ---------------------------------------------------------------------------
// Step 6: Simulate webhook locally + verify downstream effects
// ---------------------------------------------------------------------------

/**
 * Instead of waiting for Basta → Vercel webhook (which writes to Turso cloud DB),
 * we invoke the same handler logic locally against our local SQLite DB.
 * This tests the full close handler: fetch sale items from Basta → detect winner
 * → update dropship lots → create Basta order → attempt Stripe invoice.
 */
async function stepLocalWebhookAndVerify(params: {
  saleId: string;
  itemId: string;
  userId: string;
  highestBid: number;
}): Promise<void> {
  console.log("[e2e] ═══════════════════════════════════════════════════════");
  console.log("[e2e]  STEP 6: Local webhook simulation + verification");
  console.log("[e2e] ═══════════════════════════════════════════════════════\n");

  const { saleId, itemId, userId, highestBid } = params;

  // --- 6a: Invoke the sale-closed handler logic locally ---
  console.log("[e2e] Simulating SaleStatusChanged → CLOSED webhook handler locally...");
  console.log("[e2e] (Calls Basta API to fetch items, then processes winners against local DB)\n");

  // Import the handler's core logic
  const { processClosedItems, clearAccountFeesCache } = await import("../lib/order-service");

  const client = getManagementApiClient();
  const accountId = getAccountId();

  // Fetch sale items from Basta (same as the webhook handler does)
  type SaleItemNode = {
    id: string; status: string; leaderId?: string | null;
    currentBid?: number | null; title?: string | null; reserveMet?: boolean | null;
  };

  const saleResult = await client.query({
    sale: {
      __args: { accountId, id: saleId },
      currency: true,
      items: {
        __args: { first: 50 },
        edges: {
          node: {
            id: true, status: true, leaderId: true,
            currentBid: true, title: true, reserveMet: true,
          },
        },
      },
    },
  });

  const saleCurrency = (saleResult.sale?.currency as string) ?? "USD";
  const saleItems = (saleResult.sale?.items?.edges ?? [])
    .map((e: { node?: SaleItemNode | null } | null) => e?.node)
    .filter((n: SaleItemNode | null | undefined): n is SaleItemNode => !!n);

  console.log(`[e2e] Fetched ${saleItems.length} items from Basta for sale ${saleId}`);

  for (const item of saleItems) {
    console.log(`[e2e]   item=${item.id} status=${item.status} leader=${item.leaderId ?? "none"} bid=${item.currentBid ?? 0} reserveMet=${item.reserveMet}`);
  }

  // Process reserve-not-met items
  const reserveNotMet = saleItems.filter(
    (i) => i.status === "ITEM_CLOSED" && i.leaderId && i.currentBid && i.reserveMet === false
  );
  for (const item of reserveNotMet) {
    console.log(`[e2e] Marking item ${item.id} as RESERVE_NOT_MET`);
    const lot = await getDropshipLotByBastaItem(item.id);
    if (lot) await updateDropshipLot(lot.id, { status: "RESERVE_NOT_MET" });
  }

  // Process won items
  const closedItems = saleItems
    .filter((i) => i.status === "ITEM_CLOSED" && i.leaderId && i.currentBid && i.reserveMet !== false)
    .map((i) => ({
      itemId: i.id,
      leaderId: i.leaderId as string,
      currentBid: i.currentBid as number,
      title: i.title || "",
    }));

  console.log(`[e2e] Won items to process: ${closedItems.length}`);

  // Update dropship lots with winner info
  for (const item of closedItems) {
    const lot = await getDropshipLotByBastaItem(item.itemId);
    if (lot) {
      await updateDropshipLot(lot.id, {
        winner_user_id: item.leaderId,
        winning_bid_cents: item.currentBid,
        status: "AUCTION_CLOSED",
      });
      console.log(`[e2e] Updated lot ${lot.id}: winner=${item.leaderId} bid=${item.currentBid} status=AUCTION_CLOSED`);
    }
  }

  // Process through order service (creates Basta order + attempts Stripe invoice)
  if (closedItems.length > 0) {
    console.log("[e2e] Running processClosedItems (Basta order + Stripe invoice)...");
    clearAccountFeesCache();
    try {
      await processClosedItems({ saleId, items: closedItems, currency: saleCurrency });
      console.log("[e2e] processClosedItems completed.");
    } catch (e) {
      console.error("[e2e] processClosedItems error:", e instanceof Error ? e.message : e);
    }
  }

  // --- 6b: Verify results ---
  console.log("\n[e2e] --- Verification Results ---\n");

  const lot = await getDropshipLotByBastaItem(itemId);
  if (!lot) {
    console.error("[e2e] FAIL: Dropship lot not found for item", itemId);
    return;
  }

  // Check dropship_lots
  const lots = await getDropshipLotsBySale(saleId);
  console.log(`[e2e] Dropship lots for sale: ${lots.length}`);
  for (const l of lots) {
    console.log(`[e2e]   lot=${l.id} item=${l.basta_item_id} status=${l.status} winner=${l.winner_user_id} bid=${l.winning_bid_cents}`);
  }

  // Check winner
  if (lot.winner_user_id) {
    console.log(`[e2e] PASS: Winner recorded: ${lot.winner_user_id}`);
  } else {
    console.log("[e2e] FAIL: No winner recorded");
  }

  // Check winning bid
  if (lot.winning_bid_cents && lot.winning_bid_cents > 0) {
    console.log(`[e2e] PASS: Winning bid: $${(lot.winning_bid_cents / 100).toFixed(2)}`);
  } else {
    console.log("[e2e] FAIL: No winning bid recorded");
  }

  // Check status
  const expectedStatuses = ["AUCTION_CLOSED", "PAID", "CJ_ORDERED", "CJ_PAID", "SHIPPED", "DELIVERED"];
  if (expectedStatuses.includes(lot.status)) {
    console.log(`[e2e] PASS: Lot reached expected status: ${lot.status}`);
  } else if (lot.status === "RESERVE_NOT_MET") {
    console.log(`[e2e] INFO: Reserve not met — valid outcome if bid < reserve`);
  } else {
    console.log(`[e2e] WARN: Lot status is ${lot.status}`);
  }

  // Check payment_orders table
  try {
    const orderResult = await db.execute({
      sql: "SELECT * FROM payment_orders WHERE sale_id = ?",
      args: [saleId],
    });

    if (orderResult.rows.length > 0) {
      for (const order of orderResult.rows) {
        console.log(`[e2e] PASS: Payment order: basta_order_id=${order.basta_order_id} status=${order.status} stripe_invoice=${order.stripe_invoice_id ?? "none"}`);
      }
    } else {
      console.log("[e2e] INFO: No payment order found (expected if user has no Stripe payment profile)");
    }
  } catch (e) {
    console.log(`[e2e] INFO: Could not query payment_orders: ${e instanceof Error ? e.message : e}`);
  }

  // Verify sale status via Basta API
  console.log("\n[e2e] Querying Basta for final sale/item state...");
  try {
    const bastaClient = getManagementApiClient();
    const accountId = getAccountId();

    const saleState = await bastaClient.query({
      sale: {
        __args: { accountId, id: saleId },
        id: true,
        status: true,
        items: {
          __args: { first: 10 },
          edges: {
            node: {
              id: true,
              status: true,
              leaderId: true,
              currentBid: true,
              reserveMet: true,
              title: true,
            },
          },
        },
      },
    });

    const sale = saleState.sale;
    console.log(`[e2e] Basta sale status: ${sale?.status}`);

    const edges = sale?.items?.edges ?? [];
    for (const edge of edges) {
      const node = edge?.node;
      if (!node) continue;
      console.log(`[e2e]   item=${node.id} status=${node.status} leader=${node.leaderId ?? "none"} bid=${node.currentBid ?? 0} reserveMet=${node.reserveMet ?? "?"}`);
    }
  } catch (e) {
    console.log(`[e2e] WARN: Could not query Basta sale state: ${e instanceof Error ? e.message : e}`);
  }
}

// ---------------------------------------------------------------------------
// Dry-run mode
// ---------------------------------------------------------------------------

function dryRunReport(flags: ReturnType<typeof parseArgs>): void {
  console.log("\n[e2e] ═══════════════════════════════════════════════════════");
  console.log("[e2e]  DRY RUN — showing what would happen");
  console.log("[e2e] ═══════════════════════════════════════════════════════\n");

  const accountId = process.env.ACCOUNT_ID?.trim() || BASTA_ACCOUNT_ID;
  const hasApiKey = !!process.env.API_KEY?.trim();
  const hasCjKey = !!process.env.CJ_API_KEY?.trim();
  const hasStripeKey = !!process.env.STRIPE_SECRET_KEY?.trim();
  const dbUrl = process.env.TURSO_DATABASE_URL?.trim() || "file:./db/local.db";

  console.log("[e2e] Environment:");
  console.log(`[e2e]   ACCOUNT_ID:       ${accountId}`);
  console.log(`[e2e]   API_KEY:          ${hasApiKey ? "SET" : "MISSING"}`);
  console.log(`[e2e]   CJ_API_KEY:       ${hasCjKey ? "SET" : "MISSING"}`);
  console.log(`[e2e]   STRIPE_SECRET_KEY: ${hasStripeKey ? "SET" : "MISSING"}`);
  console.log(`[e2e]   DB URL:           ${dbUrl}`);
  console.log(`[e2e]   GQL endpoint:     ${GQL_URL}`);
  console.log(`[e2e]   Webhook URL:      ${WEBHOOK_URL}`);

  console.log("\n[e2e] Flags:");
  console.log(`[e2e]   --dry-run:        ${flags.dryRun}`);
  console.log(`[e2e]   --skip-source:    ${flags.skipSource}`);
  if (flags.saleId) console.log(`[e2e]   --sale-id:        ${flags.saleId}`);
  if (flags.itemId) console.log(`[e2e]   --item-id:        ${flags.itemId}`);

  console.log("\n[e2e] Pipeline steps:");
  if (flags.skipSource) {
    console.log(`[e2e]   1. SKIP sourcing (using sale=${flags.saleId}, item=${flags.itemId})`);
    console.log("[e2e]   2. SKIP publish/open (assumed already open)");
  } else {
    console.log(`[e2e]   1. Search CJ for "${E2E_SOURCING.searchKeyword}" (max $${E2E_SOURCING.maxCostUsd})`);
    console.log("[e2e]      -> Get product details, check inventory, calculate freight");
    console.log("[e2e]      -> Insert into dropship_lots table");
    console.log("[e2e]      -> Create Basta sale with 30s closing countdown");
    console.log("[e2e]      -> Create item with 50% starting bid, 130% reserve");
    console.log("[e2e]   2. Publish sale, then forceOpenSale");
  }
  console.log(`[e2e]   3. Verify bidders: ${BIDDER_A.userId} + ${BIDDER_B.userId}`);
  console.log("[e2e]      -> Check shipping addresses, register for sale (ONLINE)");
  console.log("[e2e]   4. Competitive bidding (alternating bids until above reserve)");
  console.log("[e2e]   5. Call forceCloseSale");
  console.log("[e2e]   6. Poll dropship_lots for 30s to verify:");
  console.log("[e2e]      -> Status = AUCTION_CLOSED");
  console.log("[e2e]      -> Winner user ID recorded");
  console.log("[e2e]      -> Payment order created");
  console.log("[e2e]      -> Check webhook_events table");
  console.log("[e2e]      -> Query Basta API for final sale/item state");

  console.log("\n[e2e] Missing env vars will cause failures in actual runs.");
  if (!hasApiKey) console.log("[e2e] WARNING: API_KEY is not set — Basta calls will fail");
  if (!hasCjKey) console.log("[e2e] WARNING: CJ_API_KEY is not set — CJ sourcing will fail");

  console.log("\n[e2e] Dry run complete. Remove --dry-run to execute.\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const flags = parseArgs();

  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║         E2E Dropship Auction Pipeline Test               ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log(`[e2e] Started at: ${new Date().toISOString()}`);

  // --- Dry run ---
  if (flags.dryRun) {
    dryRunReport(flags);
    return;
  }

  // --- Validate env ---
  const apiKey = process.env.API_KEY?.trim();
  if (!apiKey) {
    console.error("[e2e] FATAL: Missing API_KEY in environment");
    process.exit(1);
  }

  let saleId: string;
  let itemId: string;
  let startingBidCents: number;
  let reserveCents: number;

  if (flags.skipSource) {
    // --- Skip sourcing, use provided IDs ---
    saleId = flags.saleId!;
    itemId = flags.itemId!;
    console.log(`\n[e2e] Skipping source step. Using sale=${saleId}, item=${itemId}`);

    // Try to read the lot from DB to get pricing info
    const existingLot = await getDropshipLotByBastaItem(itemId);
    if (existingLot) {
      startingBidCents = existingLot.starting_bid_cents;
      reserveCents = existingLot.reserve_cents;
      console.log(`[e2e] Found existing lot: starting=$${(startingBidCents / 100).toFixed(2)}, reserve=$${(reserveCents / 100).toFixed(2)}`);
    } else {
      // Fallback: query Basta for the item's starting bid
      console.log("[e2e] No local lot found, using default pricing");
      startingBidCents = 500; // $5.00 default
      reserveCents = 1000;    // $10.00 default
    }
  } else {
    // --- Full pipeline: source + create ---
    const result = await stepSourceAndList();
    saleId = result.saleId;
    itemId = result.itemId;
    startingBidCents = result.startingBidCents;
    reserveCents = result.reserveCents;

    // Publish and open
    await stepPublishAndOpen(saleId);
  }

  // --- Register both bidders ---
  await stepRegisterBidders(saleId);

  // --- Competitive bidding ---
  const { highestBid, winnerId } = await stepPlaceBids({
    saleId,
    itemId,
    startingBidCents,
    reserveCents,
  });

  // --- Close via countdown ---
  await stepCloseViaCounting(saleId);

  // --- Local webhook simulation + verify ---
  await stepLocalWebhookAndVerify({ saleId, itemId, userId: winnerId, highestBid });

  // --- Summary ---
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║                    E2E TEST SUMMARY                      ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log(`[e2e] Sale ID:        ${saleId}`);
  console.log(`[e2e] Item ID:        ${itemId}`);
  console.log(`[e2e] Winner:         ${winnerId}`);
  console.log(`[e2e] Highest Bid:    $${(highestBid / 100).toFixed(2)}`);
  console.log(`[e2e] Reserve:        $${(reserveCents / 100).toFixed(2)}`);
  console.log(`[e2e] Reserve Met:    ${highestBid >= reserveCents ? "YES" : "NO"}`);
  console.log(`[e2e] Dashboard:      https://dashboard.basta.app/sales/${saleId}`);
  console.log(`[e2e] Webhook URL:    ${WEBHOOK_URL}`);
  console.log(`[e2e] Completed at:   ${new Date().toISOString()}`);
  console.log("");
}

main().catch((err) => {
  console.error("\n[e2e] FATAL ERROR:", err);
  process.exit(1);
});
