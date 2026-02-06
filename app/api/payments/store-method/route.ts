import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { upsertPaymentProfile, getPaymentProfile } from "@/lib/payment-profile";

type BillingAddress = {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
};

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const setupIntentId = body?.setupIntentId as string | undefined;
        const billingAddress = (body?.billingAddress || {}) as BillingAddress;

        if (!setupIntentId) {
            return NextResponse.json(
                { error: "setupIntentId is required" },
                { status: 400 }
            );
        }

        const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

        if (setupIntent.status !== "succeeded") {
            return NextResponse.json(
                { error: "Setup intent not completed" },
                { status: 400 }
            );
        }

        const customerId =
            typeof setupIntent.customer === "string"
                ? setupIntent.customer
                : setupIntent.customer?.id;
        const paymentMethodId =
            typeof setupIntent.payment_method === "string"
                ? setupIntent.payment_method
                : setupIntent.payment_method?.id;

        if (!customerId || !paymentMethodId) {
            return NextResponse.json(
                { error: "Missing customer or payment method" },
                { status: 400 }
            );
        }

        // Verify the setup intent's customer matches the authenticated user's Stripe customer
        const existingProfile = await getPaymentProfile(session.user.id);
        if (existingProfile?.stripe_customer_id && existingProfile.stripe_customer_id !== customerId) {
            return NextResponse.json(
                { error: "Setup intent does not belong to this account" },
                { status: 403 }
            );
        }

        try {
            await stripe.paymentMethods.attach(paymentMethodId, {
                customer: customerId,
            });
        } catch (error) {
            // Ignore if already attached
        }

        await stripe.customers.update(customerId, {
            name: billingAddress.name ?? session.user.name ?? undefined,
            email: session.user.email ?? undefined,
            address: billingAddress.line1
                ? {
                      line1: billingAddress.line1,
                      line2: billingAddress.line2 ?? undefined,
                      city: billingAddress.city ?? undefined,
                      state: billingAddress.state ?? undefined,
                      postal_code: billingAddress.postalCode ?? undefined,
                      country: billingAddress.country ?? undefined,
                  }
                : undefined,
            invoice_settings: {
                default_payment_method: paymentMethodId,
            },
        });

        await upsertPaymentProfile({
            user_id: session.user.id,
            stripe_customer_id: customerId,
            default_payment_method_id: paymentMethodId,
            billing_name: billingAddress.name ?? null,
            billing_line1: billingAddress.line1 ?? null,
            billing_line2: billingAddress.line2 ?? null,
            billing_city: billingAddress.city ?? null,
            billing_state: billingAddress.state ?? null,
            billing_postal_code: billingAddress.postalCode ?? null,
            billing_country: billingAddress.country ?? null,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Store payment method error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
