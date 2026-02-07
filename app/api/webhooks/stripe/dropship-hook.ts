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
  type DropshipLot,
  getDropshipLotByBastaItem,
  getDropshipLotByStripeInvoice,
  getDropshipLotsBySale,
  updateDropshipLot,
} from "@/lib/dropship";
import { fulfillDropshipLot } from "@/lib/dropship-fulfillment";
import { getPaymentOrderByInvoiceId } from "@/lib/db";
import {
  getBastaUserShippingAddress,
  bastaAddressToShipping,
} from "@/lib/basta-user";
import { sendEmail } from "@/lib/email";
import { sendAlert } from "@/lib/alerts";
import { getUserById } from "@/lib/user";

export async function triggerDropshipFulfillment(
  invoice: Stripe.Invoice
): Promise<void> {
  // Resolve dropship lots from the paid invoice using multiple strategies.
  // Each resolved entry pairs a lot with the basta_item_id that identified it.
  const lotsToFulfill = await resolveDropshipLots(invoice);

  if (lotsToFulfill.length === 0) {
    // Nothing to do — this invoice doesn't correspond to any dropship lots
    return;
  }

  for (const { lot, bastaItemId } of lotsToFulfill) {
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

    // Get shipping address: Basta user profile is PRIMARY source
    // (Stripe invoices with collection_method "charge_automatically" never have shipping data)
    let shippingAddress: {
      name: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
      phone?: string;
    } | null = null;

    // 1. PRIMARY: Basta user shipping address
    if (lot.winner_user_id) {
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

    // 2. FALLBACK: Stripe invoice shipping (in case Basta address is missing)
    if (!shippingAddress) {
      shippingAddress = extractShippingAddress(invoice);
      if (shippingAddress) {
        console.log(
          `[dropship-hook] Got shipping address from Stripe invoice ${invoice.id} (fallback)`
        );
      }
    }

    // 3. Validate all required fields are present
    if (shippingAddress) {
      const { name, line1, city, state, postal_code, country } = shippingAddress;
      const missingFields: string[] = [];
      if (!name) missingFields.push("name");
      if (!line1) missingFields.push("line1");
      if (!city) missingFields.push("city");
      if (!state) missingFields.push("state");
      if (!postal_code) missingFields.push("postalCode");
      if (!country) missingFields.push("country");

      if (missingFields.length > 0) {
        console.warn(
          `[dropship-hook] Shipping address for lot ${lot.id} is missing required fields: ${missingFields.join(", ")}`
        );
        await updateDropshipLot(lot.id, {
          status: "ADDRESS_INCOMPLETE",
          error_message: `Shipping address incomplete — missing: ${missingFields.join(", ")}`,
        });
        await sendAlert(
          `Lot ${lot.id} ("${lot.cj_product_name}"): shipping address incomplete — missing: ${missingFields.join(", ")}. Cannot fulfill.`,
          "critical"
        );
        continue;
      }
    }

    if (!shippingAddress) {
      console.warn(
        `[dropship-hook] No shipping address found for lot ${lot.id} (checked Basta user and Stripe invoice ${invoice.id})`
      );
      await updateDropshipLot(lot.id, {
        status: "NO_ADDRESS",
        error_message: "No shipping address found (checked Basta user profile and Stripe invoice)",
      });
      await sendAlert(
        `Lot ${lot.id} ("${lot.cj_product_name}"): no shipping address found for winner ${lot.winner_user_id ?? "unknown"}. Checked Basta user profile and Stripe invoice ${invoice.id}. Cannot fulfill.`,
        "critical"
      );
      continue;
    }

    // Store shipping address on the lot
    await updateDropshipLot(lot.id, {
      shipping_name: shippingAddress.name,
      shipping_address: JSON.stringify(shippingAddress),
    });

    // Trigger fulfillment
    const result = await fulfillDropshipLot({
      bastaItemId,
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

// ---------------------------------------------------------------------------
// Lot Resolution — multiple strategies to link invoice → dropship lots
// ---------------------------------------------------------------------------

type ResolvedLot = { lot: DropshipLot; bastaItemId: string };

async function resolveDropshipLots(
  invoice: Stripe.Invoice
): Promise<ResolvedLot[]> {
  const resolved = new Map<string, ResolvedLot>(); // keyed by lot.id to avoid duplicates

  // ── Strategy 1: Extract itemId from line item metadata ──────────────
  const lines = invoice.lines?.data ?? [];
  for (const line of lines) {
    const meta = (line as Stripe.InvoiceLineItem).metadata;
    const itemId = meta?.itemId;
    if (!itemId) continue;
    const lot = await getDropshipLotByBastaItem(itemId);
    if (lot && !resolved.has(lot.id)) {
      resolved.set(lot.id, { lot, bastaItemId: itemId });
    }
  }

  if (resolved.size > 0) {
    console.log(
      `[dropship-hook] Strategy 1 (line metadata): found ${resolved.size} lot(s) for invoice ${invoice.id}`
    );
    return Array.from(resolved.values());
  }

  // ── Strategy 2: Re-fetch invoice with expanded line items ───────────
  // Stripe may not include line item metadata on the webhook payload.
  // Fetching the invoice directly ensures we get full metadata.
  try {
    const expandedInvoice = await stripe.invoices.retrieve(invoice.id, {
      expand: ["lines.data"],
    });
    const expandedLines = expandedInvoice.lines?.data ?? [];
    for (const line of expandedLines) {
      const itemId = line.metadata?.itemId;
      if (!itemId) continue;
      const lot = await getDropshipLotByBastaItem(itemId);
      if (lot && !resolved.has(lot.id)) {
        resolved.set(lot.id, { lot, bastaItemId: itemId });
      }
    }

    if (resolved.size > 0) {
      console.log(
        `[dropship-hook] Strategy 2 (expanded invoice): found ${resolved.size} lot(s) for invoice ${invoice.id}`
      );
      return Array.from(resolved.values());
    }
  } catch (e) {
    console.warn(
      `[dropship-hook] Strategy 2 failed — could not re-fetch invoice ${invoice.id}:`,
      e
    );
  }

  // ── Strategy 3: Look up dropship_lots by stripe_invoice_id ──────────
  // The lot's stripe_invoice_id may already be set if order-service wrote it
  // during invoice creation, or a previous partial run set it.
  try {
    const lotByInvoice = await getDropshipLotByStripeInvoice(invoice.id);
    if (lotByInvoice && lotByInvoice.basta_item_id) {
      resolved.set(lotByInvoice.id, {
        lot: lotByInvoice,
        bastaItemId: lotByInvoice.basta_item_id,
      });
      console.log(
        `[dropship-hook] Strategy 3 (stripe_invoice_id lookup): found lot ${lotByInvoice.id} for invoice ${invoice.id}`
      );
      return Array.from(resolved.values());
    }
  } catch (e) {
    console.warn(
      `[dropship-hook] Strategy 3 failed — could not query lot by stripe_invoice_id:`,
      e
    );
  }

  // ── Strategy 4: Use invoice-level metadata to find lots via saleId ──
  // Invoice metadata contains saleId set by order-service.
  const invoiceSaleId = invoice.metadata?.saleId;
  if (invoiceSaleId) {
    try {
      const saleLots = await getDropshipLotsBySale(invoiceSaleId);
      // Filter to lots in AUCTION_CLOSED status (waiting for payment)
      // that have a basta_item_id and match the invoice's user
      const invoiceUserId = invoice.metadata?.userId;
      for (const lot of saleLots) {
        if (!lot.basta_item_id) continue;
        // Only match lots waiting for payment
        if (lot.status !== "AUCTION_CLOSED") continue;
        // If we know the user, narrow the match
        if (invoiceUserId && lot.winner_user_id && lot.winner_user_id !== invoiceUserId) continue;

        if (!resolved.has(lot.id)) {
          resolved.set(lot.id, { lot, bastaItemId: lot.basta_item_id });
        }
      }

      if (resolved.size > 0) {
        console.log(
          `[dropship-hook] Strategy 4 (sale lookup): found ${resolved.size} lot(s) for invoice ${invoice.id} via sale ${invoiceSaleId}`
        );
        return Array.from(resolved.values());
      }
    } catch (e) {
      console.warn(
        `[dropship-hook] Strategy 4 failed — could not query lots by sale ${invoiceSaleId}:`,
        e
      );
    }
  }

  // ── Strategy 5: Use payment_orders to bridge invoice → sale → lots ──
  try {
    const order = await getPaymentOrderByInvoiceId(invoice.id);
    if (order?.sale_id) {
      const saleLots = await getDropshipLotsBySale(order.sale_id);
      for (const lot of saleLots) {
        if (!lot.basta_item_id) continue;
        if (lot.status !== "AUCTION_CLOSED") continue;
        if (lot.winner_user_id && lot.winner_user_id !== order.user_id) continue;

        if (!resolved.has(lot.id)) {
          resolved.set(lot.id, { lot, bastaItemId: lot.basta_item_id });
        }
      }

      if (resolved.size > 0) {
        console.log(
          `[dropship-hook] Strategy 5 (payment_orders → sale): found ${resolved.size} lot(s) for invoice ${invoice.id}`
        );
        return Array.from(resolved.values());
      }
    }
  } catch (e) {
    console.warn(
      `[dropship-hook] Strategy 5 failed — could not bridge via payment_orders:`,
      e
    );
  }

  console.log(
    `[dropship-hook] No dropship lots found for invoice ${invoice.id} after all strategies`
  );
  return [];
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

  const city = s.address.city || "";
  const state = s.address.state || "";
  const postal_code = s.address.postal_code || "";

  // Return null if critical fields are empty — the validation loop downstream
  // can't detect empty strings since the fields technically "exist".
  if (!city || !state || !postal_code) return null;

  return {
    name: s.name,
    line1: s.address.line1,
    line2: s.address.line2 || undefined,
    city,
    state,
    postal_code,
    country: s.address.country || "US",
    phone: s.phone || undefined,
  };
}
