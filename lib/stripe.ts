import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
    if (!stripeInstance) {
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeSecretKey) {
            throw new Error("Missing STRIPE_SECRET_KEY");
        }
        stripeInstance = new Stripe(stripeSecretKey);
    }
    return stripeInstance;
}

// For backwards compatibility - lazy loaded
export const stripe = new Proxy({} as Stripe, {
    get(_, prop) {
        return getStripe()[prop as keyof Stripe];
    }
});
