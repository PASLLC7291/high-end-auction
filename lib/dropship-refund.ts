/**
 * Dropship Refund Service
 *
 * Handles refunds when CJ fulfillment fails after payment has been collected.
 * Failure states that trigger refunds:
 * - CJ_OUT_OF_STOCK  — CJ product went out of stock after Stripe payment
 * - CJ_PRICE_CHANGED — CJ price increased beyond the 20% threshold
 * - CJ order creation failure (lot still in PAID status with an error)
 *
 * Refund flow per lot:
 * 1. Look up the Stripe invoice from the dropship lot
 * 2. Refund the Stripe charge (or void if unpaid)
 * 3. Cancel the Basta payment order via cancelPaymentOrder mutation
 * 4. Update the dropship lot status to CANCELLED
 * 5. Update the local payment_orders record
 * 6. Send refund notification email to buyer (non-throwing)
 */

import { stripe } from "@/lib/stripe";
import { getManagementApiClient, getAccountId } from "@/lib/basta-client";
import {
  getDropshipLotsByStatus,
  updateDropshipLot,
  type DropshipLot,
  type DropshipLotStatus,
} from "@/lib/dropship";
import { updatePaymentOrder, getPaymentOrderByInvoiceId } from "@/lib/db";
import { sendAlert } from "@/lib/alerts";
import { sendEmail } from "@/lib/email";
import { getUserById } from "@/lib/user";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RefundResult =
  | { success: true; stripeRefundId: string | null; lotId: string }
  | { success: false; reason: string; lotId: string };

export type BatchRefundSummary = {
  total: number;
  succeeded: number;
  failed: number;
  results: RefundResult[];
};

/** Statuses that indicate a CJ fulfillment failure requiring refund. */
const REFUNDABLE_STATUSES: DropshipLotStatus[] = [
  "CJ_OUT_OF_STOCK",
  "CJ_PRICE_CHANGED",
];

/** Map lot status / error to a buyer-friendly refund reason. */
function refundReasonForBuyer(lot: DropshipLot): string {
  switch (lot.status) {
    case "CJ_OUT_OF_STOCK":
      return "The item is no longer available from our supplier.";
    case "CJ_PRICE_CHANGED":
      return "The supplier price changed and we are unable to fulfill this order at the original price.";
    default:
      // PAID with error_message — generic fulfillment failure
      return "We were unable to fulfill your order due to a supplier issue.";
  }
}

// ---------------------------------------------------------------------------
// Stripe refund helpers
// ---------------------------------------------------------------------------

/**
 * Refund or void a Stripe invoice.
 *
 * - If the invoice is in "draft" or "open" status it hasn't been paid, so we
 *   void it instead.
 * - If the invoice is "paid" we create a full refund on the underlying charge
 *   (or payment intent).
 * - If the invoice is already voided or uncollectible we skip.
 *
 * Returns the Stripe refund id when a refund was created, or null when the
 * invoice was voided / already cancelled.
 */
async function refundStripeInvoice(
  invoiceId: string
): Promise<{ refundId: string | null }> {
  const invoice = await stripe.invoices.retrieve(invoiceId);

  // Already voided or uncollectible — nothing to do
  if (invoice.status === "void" || invoice.status === "uncollectible") {
    console.log(
      `[refund] Stripe invoice ${invoiceId} is already ${invoice.status}, skipping`
    );
    return { refundId: null };
  }

  // Draft or open — void instead of refund (no money moved yet)
  if (invoice.status === "draft" || invoice.status === "open") {
    await stripe.invoices.voidInvoice(invoiceId);
    console.log(`[refund] Voided unpaid Stripe invoice ${invoiceId}`);
    return { refundId: null };
  }

  // Paid — refund the charge
  if (invoice.status === "paid") {
    // Stripe types vary by version — cast to access expandable fields
    const inv = invoice as unknown as Record<string, unknown>;

    // Prefer payment_intent; fall back to charge
    const rawPi = inv.payment_intent;
    const paymentIntent =
      typeof rawPi === "string"
        ? rawPi
        : (rawPi as { id?: string } | null)?.id ?? null;

    const rawCharge = inv.charge;
    const charge =
      typeof rawCharge === "string"
        ? rawCharge
        : (rawCharge as { id?: string } | null)?.id ?? null;

    if (paymentIntent) {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntent,
        reason: "requested_by_customer",
        metadata: { invoiceId, source: "dropship_refund" },
      });
      console.log(
        `[refund] Refunded payment intent ${paymentIntent} → refund ${refund.id}`
      );
      return { refundId: refund.id };
    }

    if (charge) {
      const refund = await stripe.refunds.create({
        charge,
        reason: "requested_by_customer",
        metadata: { invoiceId, source: "dropship_refund" },
      });
      console.log(`[refund] Refunded charge ${charge} → refund ${refund.id}`);
      return { refundId: refund.id };
    }

    throw new Error(
      `Invoice ${invoiceId} is paid but has no payment_intent or charge`
    );
  }

  throw new Error(
    `Unexpected invoice status "${invoice.status}" for ${invoiceId}`
  );
}

// ---------------------------------------------------------------------------
// Basta cancel helper
// ---------------------------------------------------------------------------

/**
 * Cancel a payment order in Basta using the management API.
 * Non-throwing — logs a warning on failure so the rest of the refund flow
 * can continue.
 */
async function cancelBastaPaymentOrder(orderId: string): Promise<boolean> {
  try {
    const client = getManagementApiClient();
    const accountId = getAccountId();

    const response = await client.mutation({
      cancelPaymentOrder: {
        __args: {
          accountId,
          input: { orderId },
        },
        id: true,
        status: true,
      },
    });

    const cancelledId = response.cancelPaymentOrder?.id as string | undefined;
    if (cancelledId) {
      console.log(`[refund] Cancelled Basta payment order ${orderId}`);
      return true;
    }

    console.warn(
      `[refund] cancelPaymentOrder returned no id for order ${orderId}`
    );
    return false;
  } catch (e) {
    console.error(
      `[refund] Failed to cancel Basta payment order ${orderId}:`,
      e
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Single lot refund
// ---------------------------------------------------------------------------

/**
 * Process a refund for a single dropship lot.
 *
 * Steps:
 * 1. Validate the lot is in a refundable state
 * 2. Refund / void the Stripe invoice
 * 3. Cancel the Basta payment order
 * 4. Update the dropship lot status to CANCELLED
 * 5. Update the local payment_orders record
 * 6. Send refund notification email to the buyer
 */
export async function refundDropshipLot(lot: DropshipLot): Promise<RefundResult> {
  const lotId = lot.id;

  console.log(
    `[refund] Processing refund for lot ${lotId} (status: ${lot.status})`
  );

  // ── Step 1: Validate refundable state ──────────────────────────────────
  if (
    !REFUNDABLE_STATUSES.includes(lot.status as DropshipLotStatus) &&
    lot.status !== "PAID" // PAID with error_message indicates CJ order creation failure
  ) {
    return {
      success: false,
      reason: `Lot ${lotId} is in status "${lot.status}", not refundable`,
      lotId,
    };
  }

  // For PAID lots, only refund if there's an error message (CJ order failure)
  if (lot.status === "PAID" && !lot.error_message) {
    return {
      success: false,
      reason: `Lot ${lotId} is PAID with no error — not a failed fulfillment`,
      lotId,
    };
  }

  // ── Step 2: Refund / void Stripe invoice ───────────────────────────────
  let stripeRefundId: string | null = null;

  if (lot.stripe_invoice_id) {
    try {
      const result = await refundStripeInvoice(lot.stripe_invoice_id);
      stripeRefundId = result.refundId;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.error(
        `[refund] Stripe refund failed for lot ${lotId}:`,
        e
      );

      await updateDropshipLot(lotId, {
        error_message: `Refund failed: ${reason}`,
      });

      await sendAlert(
        `Stripe refund failed for lot ${lotId}: ${reason}`,
        "critical"
      );

      return { success: false, reason: `Stripe refund failed: ${reason}`, lotId };
    }
  } else {
    console.log(
      `[refund] Lot ${lotId} has no Stripe invoice, skipping Stripe refund`
    );
  }

  // ── Step 3: Cancel Basta payment order ─────────────────────────────────
  if (lot.basta_order_id) {
    await cancelBastaPaymentOrder(lot.basta_order_id);
  } else {
    console.log(
      `[refund] Lot ${lotId} has no Basta order, skipping Basta cancellation`
    );
  }

  // ── Step 4: Update dropship lot status ─────────────────────────────────
  const refundNote = stripeRefundId
    ? `Refunded (Stripe refund: ${stripeRefundId})`
    : lot.stripe_invoice_id
      ? `Invoice voided (${lot.stripe_invoice_id})`
      : "Cancelled (no invoice)";

  await updateDropshipLot(lotId, {
    status: "CANCELLED",
    error_message: `${lot.error_message ?? lot.status} → ${refundNote}`,
  });

  // ── Step 5: Update local payment_orders record ─────────────────────────
  if (lot.stripe_invoice_id) {
    try {
      const paymentOrder = await getPaymentOrderByInvoiceId(
        lot.stripe_invoice_id
      );
      if (paymentOrder) {
        await updatePaymentOrder(paymentOrder.basta_order_id, {
          status: "REFUNDED",
        });
      }
    } catch (e) {
      console.warn(
        `[refund] Failed to update payment_orders for lot ${lotId}:`,
        e
      );
    }
  }

  // ── Step 6: Send refund notification email to buyer ───────────────────
  if (lot.winner_user_id) {
    try {
      const user = await getUserById(lot.winner_user_id);
      if (user?.email) {
        await sendEmail({
          to: user.email,
          template: "order_refunded",
          data: {
            productName: lot.cj_product_name,
            amount: lot.winning_bid_cents,
            reason: refundReasonForBuyer(lot),
          },
        });
      } else {
        console.warn(
          `[refund] No email found for winner_user_id ${lot.winner_user_id} on lot ${lotId}, skipping refund email`
        );
      }
    } catch (e) {
      // Email failures must never break the refund flow
      console.error(
        `[refund] Failed to send refund email for lot ${lotId}:`,
        e
      );
    }
  } else {
    console.warn(
      `[refund] Lot ${lotId} has no winner_user_id, skipping refund email`
    );
  }

  console.log(`[refund] Lot ${lotId} refund complete: ${refundNote}`);

  return { success: true, stripeRefundId, lotId };
}

// ---------------------------------------------------------------------------
// Batch: process all failed lots
// ---------------------------------------------------------------------------

/**
 * Find and refund all dropship lots in a CJ failure state.
 *
 * Collects lots with status CJ_OUT_OF_STOCK and CJ_PRICE_CHANGED, then
 * processes refunds sequentially. One lot's failure does not block others.
 */
export async function refundAllFailedLots(): Promise<BatchRefundSummary> {
  const failedLots: DropshipLot[] = [];

  for (const status of REFUNDABLE_STATUSES) {
    const lots = await getDropshipLotsByStatus(status);
    failedLots.push(...lots);
  }

  console.log(
    `[refund] Found ${failedLots.length} failed lots to refund`
  );

  const results: RefundResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const lot of failedLots) {
    try {
      const result = await refundDropshipLot(lot);
      results.push(result);

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.error(`[refund] Unexpected error refunding lot ${lot.id}:`, e);
      results.push({ success: false, reason, lotId: lot.id });
      failed++;
    }
  }

  console.log(
    `[refund] Batch complete: ${succeeded} succeeded, ${failed} failed out of ${failedLots.length}`
  );

  if (failed > 0) {
    const failedLotIds = results
      .filter((r) => !r.success)
      .map((r) => r.lotId)
      .join(", ");
    await sendAlert(
      `Batch refund: ${failed}/${failedLots.length} refunds failed (lots: ${failedLotIds})`,
      "critical"
    );
  }

  return {
    total: failedLots.length,
    succeeded,
    failed,
    results,
  };
}
