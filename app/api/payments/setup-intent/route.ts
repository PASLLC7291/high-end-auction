import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { getPaymentProfile, upsertPaymentProfile } from "@/lib/payment-profile";

export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const email = session.user.email ?? undefined;
        const name = session.user.name ?? undefined;

        let profile = await getPaymentProfile(userId);
        let customerId = profile?.stripe_customer_id;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email,
                name,
                metadata: { userId },
            });
            customerId = customer.id;

            await upsertPaymentProfile({
                user_id: userId,
                stripe_customer_id: customerId,
                default_payment_method_id: null,
                billing_name: null,
                billing_line1: null,
                billing_line2: null,
                billing_city: null,
                billing_state: null,
                billing_postal_code: null,
                billing_country: null,
            });
        }

        const setupIntent = await stripe.setupIntents.create({
            customer: customerId,
            usage: "off_session",
            payment_method_types: ["card"],
        });

        if (!setupIntent.client_secret) {
            return NextResponse.json(
                { error: "Failed to create setup intent" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            clientSecret: setupIntent.client_secret,
            customerId,
        });
    } catch (error) {
        console.error("Setup intent error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
