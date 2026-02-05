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
        const invoiceId = invoice.id;

        const order = await getPaymentOrderByInvoiceId(invoiceId);

        if (order?.basta_order_id) {
            const client = getManagementApiClient();
            const accountId = getAccountId();

            await client.mutation({
                createPayment: {
                    __args: {
                        accountId,
                        input: { orderId: order.basta_order_id },
                    },
                    paymentId: true,
                },
            });

            await updatePaymentOrder(order.basta_order_id, { status: "PAID" });
        }
    }

    if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object as Stripe.Invoice;
        await updatePaymentOrderByInvoiceId(invoice.id, { status: "PAYMENT_FAILED" });
    }

    return NextResponse.json({ status: "ok" });
}
