import { stripe } from "@/lib/stripe";
import { getPaymentProfile, upsertPaymentProfile } from "@/lib/payment-profile";

function toStripeCurrency(currency: string | undefined | null): string {
    const normalized = (currency || "USD").trim().toLowerCase();
    return normalized || "usd";
}

export async function ensureStripeCustomerId(params: {
    userId: string;
    email?: string | null;
    name?: string | null;
}): Promise<string> {
    const { userId, email, name } = params;
    if (!userId) {
        throw new Error("ensureStripeCustomerId: userId is required");
    }

    const existing = await getPaymentProfile(userId);
    if (existing?.stripe_customer_id) {
        return existing.stripe_customer_id;
    }

    const customer = await stripe.customers.create({
        email: email ?? undefined,
        name: name ?? undefined,
        metadata: { userId },
    });

    await upsertPaymentProfile({
        user_id: userId,
        stripe_customer_id: customer.id,
        default_payment_method_id: null,
        billing_name: null,
        billing_line1: null,
        billing_line2: null,
        billing_city: null,
        billing_state: null,
        billing_postal_code: null,
        billing_country: null,
    });

    return customer.id;
}

export async function getUserBalance(params: {
    userId: string;
}): Promise<{ balanceCents: number; currency: string }> {
    const { userId } = params;
    const profile = await getPaymentProfile(userId);
    if (!profile?.stripe_customer_id) {
        return { balanceCents: 0, currency: "USD" };
    }

    const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
    if ("deleted" in customer && customer.deleted) {
        return { balanceCents: 0, currency: "USD" };
    }

    // Stripe customer balance: negative = customer has "balance" to apply to invoices.
    const available = customer.balance < 0 ? -customer.balance : 0;
    return {
        balanceCents: available,
        currency: (customer.currency || "usd").toUpperCase(),
    };
}

export async function grantUserBalance(params: {
    userId: string;
    amountCents: number;
    currency?: string;
    description?: string;
    idempotencyKey?: string;
    email?: string | null;
    name?: string | null;
    metadata?: Record<string, string>;
}) {
    const {
        userId,
        amountCents,
        currency,
        description,
        idempotencyKey,
        email,
        name,
        metadata,
    } = params;

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
        throw new Error("grantUserBalance: amountCents must be a positive integer");
    }

    const customerId = await ensureStripeCustomerId({ userId, email, name });
    const stripeCurrency = toStripeCurrency(currency);

    const transaction = await stripe.customers.createBalanceTransaction(customerId, {
        // Negative = customer has balance available to apply to invoices
        amount: -amountCents,
        currency: stripeCurrency,
        description,
        metadata,
    }, idempotencyKey ? { idempotencyKey } : undefined);

    return {
        customerId,
        transactionId: transaction.id,
        endingBalanceCents: transaction.ending_balance,
        currency: transaction.currency.toUpperCase(),
    };
}
