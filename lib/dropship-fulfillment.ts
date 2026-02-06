/**
 * Dropship Fulfillment Service
 *
 * After a Stripe invoice is paid for a dropship lot:
 * 1. Re-checks CJ inventory (guard: item still in stock)
 * 2. Re-checks CJ price (guard: cost hasn't increased beyond margin)
 * 3. Creates CJ order with winner's shipping address
 * 4. Pays for the CJ order from CJ balance
 * 5. Confirms the CJ order
 * 6. Updates local DB with CJ order details
 *
 * Called from the Stripe webhook handler or manually via script.
 */

import { getCJClient } from "@/lib/cj-client";
import {
  getDropshipLotByBastaItem,
  updateDropshipLot,
  type DropshipLot,
} from "@/lib/dropship";
import { sendAlert } from "@/lib/alerts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ShippingAddress = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string;
};

type FulfillmentResult =
  | { success: true; cjOrderId: string; cjOrderNumber: string }
  | { success: false; reason: string; status: string };

// ---------------------------------------------------------------------------
// Main fulfillment function
// ---------------------------------------------------------------------------

export async function fulfillDropshipLot(params: {
  bastaItemId: string;
  shippingAddress: ShippingAddress;
}): Promise<FulfillmentResult> {
  const { bastaItemId, shippingAddress } = params;

  // Look up the lot
  const lot = await getDropshipLotByBastaItem(bastaItemId);
  if (!lot) {
    return {
      success: false,
      reason: `No dropship lot found for Basta item ${bastaItemId}`,
      status: "CANCELLED",
    };
  }

  // Guard: only fulfill lots in PAID status
  if (lot.status !== "PAID" && lot.status !== "AUCTION_CLOSED") {
    return {
      success: false,
      reason: `Lot ${lot.id} is in status ${lot.status}, expected PAID`,
      status: lot.status,
    };
  }

  const cj = getCJClient();

  // ── Guard 1: Re-check inventory ──────────────────────────────────────
  try {
    const inventory = await cj.getInventoryByVariant(lot.cj_vid);
    const totalStock = inventory.reduce(
      (sum, inv) => sum + inv.totalInventoryNum,
      0
    );

    if (totalStock < 1) {
      await updateDropshipLot(lot.id, {
        status: "CJ_OUT_OF_STOCK",
        error_message: `Variant ${lot.cj_vid} out of stock at fulfillment time`,
      });

      await sendAlert(
        `Lot ${lot.id}: CJ variant ${lot.cj_vid} out of stock at fulfillment time — needs refund`
      );

      return {
        success: false,
        reason: "CJ product out of stock",
        status: "CJ_OUT_OF_STOCK",
      };
    }
  } catch (e) {
    console.error(`[fulfillment] Inventory check failed for lot ${lot.id}:`, e);
    // Don't block — CJ inventory API can be flaky
  }

  // ── Guard 2: Re-check price ──────────────────────────────────────────
  try {
    const product = await cj.getProduct({ pid: lot.cj_pid });
    const variant = product.variants?.find((v) => v.vid === lot.cj_vid);
    if (variant) {
      const currentCostCents = Math.round(variant.variantSellPrice * 100);

      // If CJ price increased by more than 20%, abort
      if (currentCostCents > lot.cj_cost_cents * 1.2) {
        await updateDropshipLot(lot.id, {
          status: "CJ_PRICE_CHANGED",
          error_message: `CJ price increased from ${lot.cj_cost_cents} to ${currentCostCents} cents`,
        });

        await sendAlert(
          `Lot ${lot.id}: CJ price increased from $${(lot.cj_cost_cents / 100).toFixed(2)} to $${(currentCostCents / 100).toFixed(2)} (>20% threshold) — needs refund`
        );

        return {
          success: false,
          reason: `CJ price increased from $${(lot.cj_cost_cents / 100).toFixed(2)} to $${(currentCostCents / 100).toFixed(2)}`,
          status: "CJ_PRICE_CHANGED",
        };
      }
    }
  } catch (e) {
    console.error(`[fulfillment] Price check failed for lot ${lot.id}:`, e);
    // Don't block — proceed with original cost
  }

  // ── Create CJ order ──────────────────────────────────────────────────
  const orderNumber = `PLACER-${lot.basta_item_id}-${Date.now()}`;

  try {
    const orderResult = await cj.createOrder({
      orderNumber,
      shippingCountryCode: shippingAddress.country,
      shippingCustomerName: shippingAddress.name,
      shippingAddress: [shippingAddress.line1, shippingAddress.line2]
        .filter(Boolean)
        .join(", "),
      shippingCity: shippingAddress.city,
      shippingProvince: shippingAddress.state,
      shippingZip: shippingAddress.postal_code,
      shippingPhone: shippingAddress.phone,
      logisticName: lot.cj_logistic_name || "CJPacket",
      fromCountryCode: lot.cj_from_country || "CN",
      products: [{ vid: lot.cj_vid, quantity: 1 }],
    });

    // Validate that CJ returned a usable order ID
    if (!orderResult.orderId || typeof orderResult.orderId !== "string" || orderResult.orderId.trim() === "") {
      console.error(
        `[fulfillment] CJ createOrder returned no orderId for lot ${lot.id}:`,
        JSON.stringify(orderResult)
      );
      await updateDropshipLot(lot.id, {
        error_message: `CJ order creation returned no order ID. Response: ${JSON.stringify(orderResult)}`,
      });
      return {
        success: false,
        reason: "CJ order creation returned no order ID",
        status: lot.status,
      };
    }

    await updateDropshipLot(lot.id, {
      cj_order_id: orderResult.orderId,
      cj_order_number: orderNumber,
      cj_order_status: orderResult.orderStatus,
      shipping_name: shippingAddress.name,
      shipping_address: JSON.stringify(shippingAddress),
      total_cost_cents: lot.cj_cost_cents + lot.cj_shipping_cents,
      status: "CJ_ORDERED",
    });

    console.log(
      `[fulfillment] CJ order created: ${orderResult.orderId} for lot ${lot.id}`
    );

    // ── Pay for the order ──────────────────────────────────────────────
    try {
      await cj.payOrder(orderResult.orderId);
      await updateDropshipLot(lot.id, {
        cj_paid_at: new Date().toISOString(),
        cj_order_status: "UNSHIPPED",
        status: "CJ_PAID",
      });
      console.log(`[fulfillment] CJ order paid: ${orderResult.orderId}`);
    } catch (payErr) {
      const payReason = payErr instanceof Error ? payErr.message : String(payErr);
      console.error(
        `[fulfillment] CJ payment failed for order ${orderResult.orderId}:`,
        payErr
      );
      await updateDropshipLot(lot.id, {
        error_message: `CJ payment failed: ${payReason}`,
        // Keep status as CJ_ORDERED so retry logic can pick it up
      });
      return {
        success: false,
        reason: `CJ payment failed: ${payReason}`,
        status: "CJ_ORDERED",
      };
    }

    // ── Confirm the order (non-blocking) ─────────────────────────────
    try {
      await cj.confirmOrder(orderResult.orderId);
      console.log(`[fulfillment] CJ order confirmed: ${orderResult.orderId}`);
    } catch (confirmErr) {
      console.warn(
        `[fulfillment] CJ confirm failed (non-blocking): ${confirmErr}`
      );
      // Confirm failure is non-fatal — order is created and paid
    }

    // Calculate profit
    const totalCost = lot.cj_cost_cents + lot.cj_shipping_cents;
    const profit = (lot.winning_bid_cents ?? 0) - totalCost;
    await updateDropshipLot(lot.id, { profit_cents: profit });

    return {
      success: true,
      cjOrderId: orderResult.orderId,
      cjOrderNumber: orderNumber,
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error(`[fulfillment] CJ order creation failed for lot ${lot.id}:`, e);

    await updateDropshipLot(lot.id, {
      error_message: `CJ order failed: ${reason}`,
    });

    await sendAlert(
      `Lot ${lot.id} ("${lot.cj_product_name}"): CJ order creation failed — ${reason}`,
      "critical"
    );

    return { success: false, reason, status: lot.status };
  }
}

// ---------------------------------------------------------------------------
// Batch: process all PAID dropship lots
// ---------------------------------------------------------------------------

export async function fulfillAllPaidLots(): Promise<void> {
  const { getDropshipLotsByStatus } = await import("@/lib/dropship");

  const paidLots = await getDropshipLotsByStatus("PAID");
  console.log(`[fulfillment] Found ${paidLots.length} lots to fulfill`);

  for (const lot of paidLots) {
    if (!lot.basta_item_id) continue;

    // We need a shipping address — check if it's stored
    if (!lot.shipping_address) {
      console.warn(
        `[fulfillment] Lot ${lot.id} has no shipping address, skipping`
      );
      await sendAlert(
        `Lot ${lot.id} is PAID but has no shipping address — cannot fulfill`
      );
      continue;
    }

    const address = JSON.parse(lot.shipping_address) as ShippingAddress;
    const result = await fulfillDropshipLot({
      bastaItemId: lot.basta_item_id,
      shippingAddress: address,
    });

    if (result.success) {
      console.log(
        `[fulfillment] Lot ${lot.id} → CJ order ${result.cjOrderId}`
      );
    } else {
      console.error(
        `[fulfillment] Lot ${lot.id} failed: ${(result as { reason: string }).reason}`
      );
    }
  }
}
