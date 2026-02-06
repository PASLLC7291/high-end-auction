"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Zod schema — mirrors the required fields in the API route
// ---------------------------------------------------------------------------
const registrationFormSchema = z.object({
    phone: z.string().min(1, "Phone number is required"),
    shippingName: z.string().optional(),
    line1: z.string().min(1, "Address line 1 is required"),
    line2: z.string().optional(),
    city: z.string().min(1, "City is required"),
    state: z.string().optional(),
    postalCode: z.string().min(1, "Postal code is required"),
    country: z.string().min(1, "Country is required"),
    agreedToTerms: z.literal(true, {
        errorMap: () => ({ message: "You must agree to the terms and conditions" }),
    }),
});

type RegistrationFormValues = z.infer<typeof registrationFormSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SaleRegistration {
    id: string;
    registrationType: string;
    saleId: string;
    status: string;
    userId: string;
}

interface RegistrationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    auctionId: string;
    auctionTitle: string;
    onRegistrationComplete?: (registration: SaleRegistration) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function RegistrationModal({
    open,
    onOpenChange,
    auctionId,
    auctionTitle,
    onRegistrationComplete,
}: RegistrationModalProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const form = useForm<RegistrationFormValues>({
        resolver: zodResolver(registrationFormSchema),
        defaultValues: {
            phone: "",
            shippingName: "",
            line1: "",
            line2: "",
            city: "",
            state: "",
            postalCode: "",
            country: "",
            agreedToTerms: undefined as unknown as true,
        },
    });

    const onSubmit = async (values: RegistrationFormValues) => {
        setError(null);

        if (!session?.user) {
            router.push("/login");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("/api/protected/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    saleId: auctionId,
                    identifier: values.phone,
                    shippingAddress: {
                        name: values.shippingName || undefined,
                        line1: values.line1,
                        line2: values.line2 || undefined,
                        city: values.city,
                        state: values.state || undefined,
                        postalCode: values.postalCode,
                        country: values.country,
                    },
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to register");
            }

            const registration: SaleRegistration = data.registration;

            setSuccess(true);
            onRegistrationComplete?.(registration);

            // Close modal after a short delay
            setTimeout(() => {
                onOpenChange(false);
                setSuccess(false);
                form.reset();
            }, 2000);
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to register. Please try again.";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    // ---- Unauthenticated state ----
    if (!session?.user) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-xl">
                            Sign In Required
                        </DialogTitle>
                        <DialogDescription>
                            Please sign in to register for this auction.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => router.push("/login")}>Sign In</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    // ---- Success state ----
    if (success) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <div className="flex flex-col items-center py-6 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                        </div>
                        <DialogTitle className="font-serif text-xl">
                            Registration Successful!
                        </DialogTitle>
                        <DialogDescription className="mt-2">
                            You are now registered to bid in &ldquo;{auctionTitle}&rdquo;.
                        </DialogDescription>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // ---- Registration form ----
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-serif text-xl">
                        Register to Bid
                    </DialogTitle>
                    <DialogDescription>
                        Complete your registration to participate in &ldquo;{auctionTitle}&rdquo;.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {/* User info (pre-filled from session) */}
                        <div className="rounded-lg border border-border bg-muted/30 p-4">
                            <p className="text-sm font-medium">{session.user.name}</p>
                            <p className="text-sm text-muted-foreground">
                                {session.user.email}
                            </p>
                        </div>

                        {/* Phone */}
                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Phone Number</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="tel"
                                            placeholder="+1 (555) 000-0000"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* ---- Shipping Address Section ---- */}
                        <div className="space-y-3">
                            <p className="text-sm font-medium">Shipping Address</p>

                            {/* Name (optional) */}
                            <FormField
                                control={form.control}
                                name="shippingName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Jane Doe" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Address Line 1 */}
                            <FormField
                                control={form.control}
                                name="line1"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Address Line 1</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="123 Main Street"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Address Line 2 (optional) */}
                            <FormField
                                control={form.control}
                                name="line2"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Address Line 2</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Apt, suite, unit, etc."
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* City + State */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="city"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>City</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="New York"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="state"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>State / Province</FormLabel>
                                            <FormControl>
                                                <Input placeholder="NY" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Postal Code + Country */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="postalCode"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Postal Code</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="10001"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="country"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Country</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="United States"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Terms checkbox */}
                        <FormField
                            control={form.control}
                            name="agreedToTerms"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-start space-x-3 rounded-lg border border-border p-4">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value === true}
                                                onCheckedChange={(checked) =>
                                                    field.onChange(checked === true ? true : undefined)
                                                }
                                            />
                                        </FormControl>
                                        <div className="space-y-1">
                                            <Label
                                                htmlFor={field.name}
                                                className="cursor-pointer text-sm"
                                            >
                                                I agree to the Terms &amp; Conditions
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                By registering, you agree to our bidding terms,
                                                buyer&apos;s premium, and conditions of sale.
                                            </p>
                                        </div>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Server error message */}
                        {error && (
                            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <DialogFooter className="mt-6">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                {loading ? "Registering..." : "Complete Registration"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export default RegistrationModal;
