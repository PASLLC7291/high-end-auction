"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

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
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    // Form fields
    const [formData, setFormData] = useState({
        phone: "",
        address: "",
        city: "",
        country: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!session?.user) {
            router.push("/login");
            return;
        }

        if (!agreedToTerms) {
            setError("Please agree to the terms and conditions");
            return;
        }

        setLoading(true);

        try {
            // Call the protected API route to create the sale registration
            const response = await fetch("/api/protected/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    saleId: auctionId,
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
                setFormData({ phone: "", address: "", city: "", country: "" });
                setAgreedToTerms(false);
            }, 2000);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to register. Please try again.";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

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
                            You are now registered to bid in "{auctionTitle}".
                        </DialogDescription>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="font-serif text-xl">
                        Register to Bid
                    </DialogTitle>
                    <DialogDescription>
                        Complete your registration to participate in "{auctionTitle}".
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* User info (pre-filled from session) */}
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                        <p className="text-sm font-medium">{session.user.name}</p>
                        <p className="text-sm text-muted-foreground">{session.user.email}</p>
                    </div>

                    {/* Additional fields */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="+1 (555) 000-0000"
                                value={formData.phone}
                                onChange={(e) =>
                                    setFormData({ ...formData, phone: e.target.value })
                                }
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="country">Country</Label>
                            <Input
                                id="country"
                                placeholder="United States"
                                value={formData.country}
                                onChange={(e) =>
                                    setFormData({ ...formData, country: e.target.value })
                                }
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Input
                            id="address"
                            placeholder="123 Main Street"
                            value={formData.address}
                            onChange={(e) =>
                                setFormData({ ...formData, address: e.target.value })
                            }
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                            id="city"
                            placeholder="New York"
                            value={formData.city}
                            onChange={(e) =>
                                setFormData({ ...formData, city: e.target.value })
                            }
                            required
                        />
                    </div>

                    {/* Terms checkbox */}
                    <div className="flex items-start space-x-3 rounded-lg border border-border p-4">
                        <Checkbox
                            id="terms"
                            checked={agreedToTerms}
                            onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                        />
                        <div className="space-y-1">
                            <Label htmlFor="terms" className="cursor-pointer text-sm">
                                I agree to the Terms & Conditions
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                By registering, you agree to our bidding terms, buyer's premium,
                                and conditions of sale.
                            </p>
                        </div>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4" />
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
                        <Button type="submit" disabled={loading || !agreedToTerms}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {loading ? "Registering..." : "Complete Registration"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default RegistrationModal;

