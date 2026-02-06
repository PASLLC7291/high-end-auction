/**
 * Dropship fulfillment hook for Stripe webhook.
 *
 * When a Stripe invoice is paid, checks if any of the invoice line items
 * correspond to a dropship lot. If so, triggers CJ order creation.
 *
 * This runs fire-and-forget from the Stripe webhook handler.
 */

import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import {
  getDropshipLotByBastaItem,
  updateDropshipLot,
} from "@/lib/dropship";
import { fulfillDropshipLot } from "@/lib/dropship-fulfillment";
import { getPaymentOrderByInvoiceId } from "@/lib/db";
import {
  getBastaUserShippingAddress,
  bastaAddressToShipping,
} from "@/lib/basta-user";
import { sendEmail } from "@/lib/email";
import { getUserById } from "@/lib/user";

export async function triggerDropshipFulfillment(
  invoice: Stripe.Invoice
): Promise<void> {
  // Get the Basta item IDs from invoice line items metadata
  const itemIds = new Set<string>();

  // Line items might be on the invoice object or need fetching
  const lines = invoice.lines?.data ?? [];
  for (const line of lines) {
    const itemId = (line as Stripe.InvoiceLineItem).metadata?.itemId;
    if (itemId) itemIds.add(itemId);
  }

  // If no line-level metadata, try to get items from payment_order_items
  if (itemIds.size === 0) {
    const order = await getPaymentOrderByInvoiceId(invoice.id);
    if (!order) return; // Not a dropship order
    // Can't determine individual items — skip
    return;
  }

  // Check each item to see if it's a dropship lot
  for (const itemId of itemIds) {
    const lot = await getDropshipLotByBastaItem(itemId);
    if (!lot) continue; // Not a dropship item

    // Mark as PAID so fulfillment can proceed
    await updateDropshipLot(lot.id, {
      status: "PAID",
      stripe_invoice_id: invoice.id,
      winning_bid_cents: lot.winning_bid_cents, // already set by Basta webhook
    });

    // Fire-and-forget: send payment_received email to buyer
    if (lot.winner_user_id) {
      getUserById(lot.winner_user_id)
        .then((user) => {
          if (!user?.email) return;
          sendEmail({
            to: user.email,
            template: "payment_received",
            data: {
              productName: lot.cj_product_name,
              amount: lot.winning_bid_cents,
            },
          });
        })
        .catch((e) =>
          console.warn(`[email] Failed to send payment_received for lot ${lot.id}:`, e)
        );
    }

    // Get shipping address: try Basta user profile first, then Stripe invoice
    let shippingAddress = extractShippingAddress(invoice);

    if (!shippingAddress && lot.winner_user_id) {
      try {
        const bastaAddr = await getBastaUserShippingAddress(lot.winner_user_id);
        if (bastaAddr?.line1) {
          shippingAddress = bastaAddressToShipping(bastaAddr);
          console.log(
            `[dropship-hook] Got shipping address from Basta for user ${lot.winner_user_id}`
          );
        }
      } catch (e) {
        console.warn(
          `[dropship-hook] Failed to fetch Basta address for user ${lot.winner_user_id}:`,
          e
        );
      }
    }

    if (!shippingAddress) {
      console.warn(
        `[dropship-hook] No shipping address on invoice ${invoice.id} or Basta for lot ${lot.id}`
      );
      await updateDropshipLot(lot.id, {
        error_message: "No shipping address found (checked Stripe invoice and Basta user profile)",
      });
      continue;
    }

    // Store shipping address on the lot
    await updateDropshipLot(lot.id, {
      shipping_name: shippingAddress.name,
      shipping_address: JSON.stringify(shippingAddress),
    });

    // Trigger fulfillment
    const result = await fulfillDropshipLot({
      bastaItemId: itemId,
      shippingAddress,
    });

    if (result.success) {
      console.log(
        `[dropship-hook] Fulfilled lot ${lot.id} → CJ order ${result.cjOrderId}`
      );
    } else {
      console.error(
        `[dropship-hook] Fulfillment failed for lot ${lot.id}: ${result.reason}`
      );
    }
  }
}

function extractShippingAddress(
  invoice: Stripe.Invoice
): {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string;
} | null {
  // Try shipping_details first (from Checkout), then customer_shipping
  const shipping =
    (invoice as unknown as Record<string, unknown>).shipping_details ??
    invoice.customer_shipping;

  if (!shipping) return null;

  const s = shipping as {
    name?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
    phone?: string;
  };

  if (!s.address?.line1 || !s.name) return null;

  return {
    name: s.name,
    line1: s.address.line1,
    line2: s.address.line2 || undefined,
    city: s.address.city || "",
    state: s.address.state || "",
    postal_code: s.address.postal_code || "",
    country: s.address.country || "US",
    phone: s.phone || undefined,
  };
}
