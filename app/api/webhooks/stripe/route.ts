import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getAccountId, getManagementApiClient } from "@/lib/basta-client";
import {
    markWebhookProcessed,
    getPaymentOrderByInvoiceId,
    updatePaymentOrder,
    updatePaymentOrderByInvoiceId,
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBastaOrderId(invoice: Stripe.Invoice): string | null {
    // Primary: read from Stripe invoice metadata (set by tryCreateStripeInvoice)
    const fromMetadata = invoice.metadata?.bastaOrderId;
    if (fromMetadata) return fromMetadata;
    return null;
}

export async function POST(request: NextRequest) {
    const signature = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

    if (!webhookSecret || !signature) {
        return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
    }

    const body = await request.text();
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
        console.error("Stripe webhook signature error:", error);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const processed = await markWebhookProcessed("stripe", event.id, event);
    if (!processed) {
        return NextResponse.json({ status: "ignored" });
    }

    if (event.type === "invoice.payment_succeeded" || event.type === "invoice.paid") {
        const invoice = event.data.object as Stripe.Invoice;

        // Try metadata first, fall back to local DB for backwards compat
        let bastaOrderId = getBastaOrderId(invoice);
        if (!bastaOrderId) {
            const order = await getPaymentOrderByInvoiceId(invoice.id);
            bastaOrderId = order?.basta_order_id ?? null;
        }

        if (bastaOrderId) {
            const client = getManagementApiClient();
            const accountId = getAccountId();

            await client.mutation({
                createPayment: {
                    __args: {
                        accountId,
                        input: { orderId: bastaOrderId },
                    },
                    paymentId: true,
                },
            });

            // Audit log — fire-and-forget
            await updatePaymentOrder(bastaOrderId, { status: "PAID" });
        }
    }

    if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object as Stripe.Invoice;

        // Try metadata first, fall back to local DB
        let bastaOrderId = getBastaOrderId(invoice);
        if (!bastaOrderId) {
            const order = await getPaymentOrderByInvoiceId(invoice.id);
            bastaOrderId = order?.basta_order_id ?? null;
        }

        // Audit log — fire-and-forget
        if (bastaOrderId) {
            await updatePaymentOrder(bastaOrderId, { status: "PAYMENT_FAILED" });
        } else {
            await updatePaymentOrderByInvoiceId(invoice.id, { status: "PAYMENT_FAILED" });
        }
    }

    return NextResponse.json({ status: "ok" });
}
