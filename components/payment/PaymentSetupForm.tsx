"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
    CardElement,
    Elements,
    useElements,
    useStripe,
} from "@stripe/react-stripe-js";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type BillingAddressState = {
    name: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
};

const defaultBilling: BillingAddressState = {
    name: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
};

function SetupForm({
    clientSecret,
    onSuccess,
}: {
    clientSecret: string;
    onSuccess: () => void;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const { data: session, update } = useSession();
    const [billing, setBilling] = useState<BillingAddressState>(defaultBilling);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleChange = (field: keyof BillingAddressState) => (
        event: ChangeEvent<HTMLInputElement>
    ) => {
        setBilling((prev) => ({ ...prev, [field]: event.target.value }));
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);

        if (!stripe || !elements) return;
        if (!session?.user) {
            setError("Please sign in to add a card.");
            return;
        }

        setSubmitting(true);
        try {
            const cardElement = elements.getElement(CardElement);
            if (!cardElement) {
                setError("Card element not ready.");
                return;
            }

            const result = await stripe.confirmCardSetup(clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: billing.name || session.user.name || undefined,
                        address: {
                            line1: billing.line1 || undefined,
                            line2: billing.line2 || undefined,
                            city: billing.city || undefined,
                            state: billing.state || undefined,
                            postal_code: billing.postalCode || undefined,
                            country: billing.country || undefined,
                        },
                    },
                },
            });

            if (result.error || !result.setupIntent?.id) {
                setError(result.error?.message || "Failed to save card.");
                return;
            }

            const res = await fetch("/api/payments/store-method", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    setupIntentId: result.setupIntent.id,
                    billingAddress: billing,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to store payment method.");
            }

            await update();
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unexpected error.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="billing-name">Name on card</Label>
                    <Input
                        id="billing-name"
                        value={billing.name}
                        onChange={handleChange("name")}
                        placeholder="Jane Doe"
                    />
                </div>
                <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="billing-line1">Address</Label>
                    <Input
                        id="billing-line1"
                        value={billing.line1}
                        onChange={handleChange("line1")}
                        placeholder="123 Main St"
                    />
                </div>
                <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="billing-line2">Address line 2</Label>
                    <Input
                        id="billing-line2"
                        value={billing.line2}
                        onChange={handleChange("line2")}
                        placeholder="Apt 4B"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="billing-city">City</Label>
                    <Input
                        id="billing-city"
                        value={billing.city}
                        onChange={handleChange("city")}
                        placeholder="New York"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="billing-state">State</Label>
                    <Input
                        id="billing-state"
                        value={billing.state}
                        onChange={handleChange("state")}
                        placeholder="NY"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="billing-postal">Postal code</Label>
                    <Input
                        id="billing-postal"
                        value={billing.postalCode}
                        onChange={handleChange("postalCode")}
                        placeholder="10001"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="billing-country">Country</Label>
                    <Input
                        id="billing-country"
                        value={billing.country}
                        onChange={handleChange("country")}
                        placeholder="US"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Card details</Label>
                <div className="rounded-md border border-input bg-background px-3 py-2">
                    <CardElement options={{ hidePostalCode: true }} />
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>Payment setup failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Button type="submit" disabled={!stripe || submitting}>
                {submitting ? "Saving..." : "Save card"}
            </Button>
        </form>
    );
}

export function PaymentSetupForm() {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
    const stripePromise = useMemo(
        () => (publishableKey ? loadStripe(publishableKey) : null),
        [publishableKey]
    );
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl");
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const statusRes = await fetch("/api/payments/status");
                const statusData = await statusRes.json();
                if (statusData?.hasPaymentMethod) {
                    setHasPaymentMethod(true);
                    return;
                }

                const res = await fetch("/api/payments/setup-intent", {
                    method: "POST",
                });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || "Failed to start setup.");
                }
                setClientSecret(data.clientSecret);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Error loading.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (!publishableKey) {
        return (
            <Alert variant="destructive">
                <AlertTitle>Missing Stripe key</AlertTitle>
                <AlertDescription>
                    Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable card setup.
                </AlertDescription>
            </Alert>
        );
    }

    if (loading) {
        return <p className="text-muted-foreground">Loading payment setup...</p>;
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertTitle>Unable to load payment setup</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    if (hasPaymentMethod) {
        return (
            <Alert>
                <AlertTitle>Card on file</AlertTitle>
                <AlertDescription>
                    Your card is saved and ready for bidding.
                </AlertDescription>
            </Alert>
        );
    }

    if (!clientSecret || !stripePromise) {
        return (
            <Alert variant="destructive">
                <AlertTitle>Payment setup unavailable</AlertTitle>
                <AlertDescription>
                    Please try again in a moment.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
            <SetupForm
                clientSecret={clientSecret}
                onSuccess={() => {
                    setHasPaymentMethod(true);
                    if (callbackUrl) {
                        router.push(callbackUrl);
                    }
                }}
            />
        </Elements>
    );
}
