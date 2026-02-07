/**
 * E2E Pipeline Test — Full Payment Flow
 *
 * 1. Creates a Stripe customer with test card (pm_card_visa)
 * 2. Inserts payment profile into DB
 * 3. Creates a 5-minute auction, bids above reserve
 * 4. Waits for close, runs poll pipeline
 * 5. Invoice created + auto-charged → Stripe webhook fires
 * 6. Webhook triggers fulfillment (CJ will fail due to $0 balance — expected)
 *
 * Prerequisites:
 *   - Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` in another terminal
 *   - Run `pnpm dev` in another terminal
 *
 * Usage: npx tsx scripts/e2e-test.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import Stripe from "stripe";
import { getManagementApiClient, getClientApiClient, getAccountId } from "../lib/basta-client";
import { insertDropshipLot, updateDropshipLot, getDropshipLotsBySale } from "../lib/dropship";
import { upsertPaymentProfile } from "../lib/payment-profile";
import { pollAndProcessClosedSales } from "../lib/pipeline";
import { db } from "../lib/turso";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-03-31.basil" as any,
});

async function main() {
  const accountId = getAccountId();
  const bastaClient = getManagementApiClient();
  const testUserId = "e2e-stripe-" + Date.now();

  console.log("=== E2E Pipeline Test (Full Payment Flow) ===\n");

  // Step 1: Create Stripe customer with test card
  console.log("[1/9] Creating Stripe test customer...");
  const customer = await stripe.customers.create({
    name: "E2E Test User",
    email: `${testUserId}@test.fastbid.co`,
    metadata: { testUserId },
  });
  console.log(`  Customer: ${customer.id}`);

  // Attach test card
  const pm = await stripe.paymentMethods.attach("pm_card_visa", {
    customer: customer.id,
  });
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: pm.id },
  });
  console.log(`  Payment method: ${pm.id} (Visa test card)`);

  // Step 2: Create user + payment profile in DB
  console.log("\n[2/9] Creating user and payment profile in DB...");
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [testUserId, `${testUserId}@test.fastbid.co`, "e2e-test-no-login", "E2E Test User", now, now],
  });
  console.log(`  User created: ${testUserId}`);
  await upsertPaymentProfile({
    user_id: testUserId,
    stripe_customer_id: customer.id,
    default_payment_method_id: pm.id,
    billing_name: "E2E Test User",
    billing_line1: "123 Test Street",
    billing_line2: null,
    billing_city: "Auburn",
    billing_state: "CA",
    billing_postal_code: "95603",
    billing_country: "US",
  });
  console.log(`  Payment profile saved for ${testUserId}`);

  // Step 3: Create test product + DB lot
  console.log("\n[3/9] Creating test product...");
  const productName = "E2E Stripe Test Item";
  const productCostCents = 500;
  const shippingCostCents = 500;
  const totalCostCents = productCostCents + shippingCostCents;
  const startingBidCents = Math.max(100, Math.round(totalCostCents * 0.5));
  const reserveCents = Math.round(totalCostCents * 1.3);

  console.log(`  Product: ${productName}`);
  console.log(`  Cost: $${(totalCostCents / 100).toFixed(2)} | Starting: $${(startingBidCents / 100).toFixed(2)} | Reserve: $${(reserveCents / 100).toFixed(2)}`);

  const lotId = await insertDropshipLot({
    cj_pid: "e2e-stripe-pid",
    cj_vid: "e2e-stripe-vid",
    cj_product_name: productName,
    cj_variant_name: productName,
    cj_cost_cents: productCostCents,
    cj_shipping_cents: shippingCostCents,
    starting_bid_cents: startingBidCents,
    reserve_cents: reserveCents,
  });
  console.log(`  Lot ID: ${lotId}`);

  // Step 4: Create Basta sale (5-minute window)
  console.log("\n[4/9] Creating fast-close Basta sale...");
  const openDate = new Date(Date.now() + 30 * 1000).toISOString();
  const closingDate = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const saleResult = await bastaClient.mutation({
    createSale: {
      __args: {
        accountId,
        input: {
          title: `E2E Stripe Test — ${new Date().toISOString().slice(0, 16)}`,
          description: "E2E test with full Stripe payment flow",
          currency: "USD",
          closingMethod: "OVERLAPPING",
          closingTimeCountdown: 30000,
          bidIncrementTable: {
            rules: [
              { lowRange: 0, highRange: 1000, step: 100 },
              { lowRange: 1000, highRange: 5000, step: 250 },
            ],
          },
        },
      },
      id: true,
      title: true,
    },
  });

  const saleId = saleResult.createSale?.id as string;
  if (!saleId) throw new Error("No sale ID");
  console.log(`  Sale ID: ${saleId}`);
  console.log(`  Opens:   ${openDate}`);
  console.log(`  Closes:  ${closingDate}`);

  // Step 5: Create item + publish
  console.log("\n[5/9] Adding item and publishing...");
  const itemResult = await bastaClient.mutation({
    createItemForSale: {
      __args: {
        accountId,
        input: {
          saleId,
          title: productName,
          description: productName,
          startingBid: startingBidCents,
          reserve: reserveCents,
          openDate,
          closingDate,
          allowedBidTypes: ["MAX", "NORMAL"],
        },
      },
      id: true,
    },
  });

  const itemId = itemResult.createItemForSale?.id as string;
  if (!itemId) throw new Error("No item ID");
  console.log(`  Item ID: ${itemId}`);

  await updateDropshipLot(lotId, {
    basta_sale_id: saleId,
    basta_item_id: itemId,
    status: "LISTED",
  });

  await bastaClient.mutation({
    publishSale: {
      __args: { accountId, input: { saleId } },
      id: true,
    },
  });
  await updateDropshipLot(lotId, { status: "PUBLISHED" });
  console.log("  Published!");

  // Step 6: Wait for open
  console.log("\n[6/9] Waiting for sale to open...");
  const openTime = new Date(openDate).getTime();
  while (Date.now() < openTime) {
    const remaining = Math.ceil((openTime - Date.now()) / 1000);
    process.stdout.write(`\r  Opening in ${remaining}s...  `);
    await sleep(2000);
  }
  console.log("\n  Waiting 10s for Basta to transition...");
  await sleep(10000);

  // Step 7: Place bid
  console.log("\n[7/9] Placing bid...");
  const tokenResult = await bastaClient.mutation({
    createBidderToken: {
      __args: {
        accountId,
        input: {
          metadata: { userId: testUserId, ttl: 30 },
        },
      },
      token: true,
      expiration: true,
    },
  });

  const bidderToken = tokenResult.createBidderToken?.token as string;
  if (!bidderToken) throw new Error("No bidder token");

  const clientApi = getClientApiClient(bidderToken);
  const bidAmount = Math.max(reserveCents, startingBidCents + 100);
  console.log(`  Bidding $${(bidAmount / 100).toFixed(2)}...`);

  const bidResult = await clientApi.mutation({
    bidOnItem: {
      __args: { saleId, itemId, amount: bidAmount, type: "MAX" },
      __typename: true,
      on_BidPlacedError: { error: true, errorCode: true },
      on_MaxBidPlacedSuccess: { amount: true, maxAmount: true, bidStatus: true },
      on_BidPlacedSuccess: { amount: true, bidStatus: true },
    },
  });

  const bid = bidResult.bidOnItem;
  if (bid?.__typename === "BidPlacedError") {
    console.error(`  Bid FAILED: ${(bid as any).errorCode} — ${(bid as any).error}`);
    throw new Error("Bid failed — cannot test payment flow");
  }
  console.log(`  Bid placed! ${bid?.__typename}: $${((bid as any).amount / 100).toFixed(2)}`);

  // Step 8: Wait for close + process
  console.log("\n[8/9] Waiting for auction to close...");
  const closeTime = new Date(closingDate).getTime();
  while (Date.now() < closeTime + 45000) {
    const remaining = Math.ceil((closeTime - Date.now()) / 1000);
    if (remaining > 0) {
      process.stdout.write(`\r  Closing in ${remaining}s...  `);
    } else {
      process.stdout.write(`\r  Closed. Finalizing...       `);
    }
    await sleep(3000);
  }

  console.log("\n\n  Running post-close pipeline...");
  const pollResult = await pollAndProcessClosedSales();
  console.log(`  Poll: ${pollResult.newlyProcessed} newly processed, ${pollResult.reserveNotMet} reserve not met`);

  // Step 9: Check results
  console.log("\n[9/9] Checking results...");

  // Give Stripe a moment to process the invoice
  await sleep(5000);

  const lots = await getDropshipLotsBySale(saleId);
  const lot = lots[0];

  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║         FINAL STATUS REPORT          ║`);
  console.log(`  ╠══════════════════════════════════════╣`);
  console.log(`  ║  Lot ID:      ${(lot?.id || "N/A").substring(0, 20).padEnd(20)} ║`);
  console.log(`  ║  Status:      ${(lot?.status || "N/A").padEnd(20)} ║`);
  console.log(`  ║  Winner:      ${(lot?.winner_user_id || "none").substring(0, 20).padEnd(20)} ║`);
  if (lot?.winning_bid_cents)
    console.log(`  ║  Winning bid: $${(lot.winning_bid_cents / 100).toFixed(2).padEnd(19)} ║`);
  if (lot?.stripe_invoice_id)
    console.log(`  ║  Invoice:     ${lot.stripe_invoice_id.substring(0, 20).padEnd(20)} ║`);
  if (lot?.error_message)
    console.log(`  ║  Error:       ${lot.error_message.substring(0, 20).padEnd(20)} ║`);
  console.log(`  ╚══════════════════════════════════════╝`);

  // Check if invoice was created
  if (lot?.stripe_invoice_id) {
    const inv = await stripe.invoices.retrieve(lot.stripe_invoice_id);
    console.log(`\n  Stripe Invoice: ${inv.status} — $${((inv.amount_due || 0) / 100).toFixed(2)}`);
    if (inv.status === "paid") {
      console.log("  PAYMENT SUCCESSFUL!");
      console.log("\n  Next step: Stripe webhook → dropship-hook → CJ fulfillment");
      console.log("  (CJ will fail due to $0 balance — that's expected for this test)");
      console.log("  Check the stripe listen terminal for the webhook delivery.");
    }
  } else {
    console.log("\n  No invoice created yet. The pipeline may need another poll cycle.");
    console.log("  The lot should be in AUCTION_CLOSED status, waiting for invoice.");
  }

  console.log(`\n  Basta: https://dashboard.basta.app/sales/${saleId}`);
  console.log(`  Stripe: https://dashboard.stripe.com/test/customers/${customer.id}`);
  console.log("\n=== E2E Test Complete ===");
}

main().catch((e) => {
  console.error("\nE2E test failed:", e);
  process.exit(1);
});
