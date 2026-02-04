import { Suspense } from "react";
import { PaymentSetupForm } from "@/components/payment/PaymentSetupForm";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, CreditCard } from "lucide-react";

export default function PaymentPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-semibold">Payment Methods</h2>
                <p className="text-muted-foreground mt-1">
                    Add a card to enable bidding. Your card will be charged
                    automatically if you win.
                </p>
            </div>

            <Card className="border-border/50">
                <CardContent className="p-6">
                    <Suspense fallback={
                        <div className="flex items-center justify-center py-8">
                            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    }>
                        <PaymentSetupForm />
                    </Suspense>
                </CardContent>
            </Card>

            {/* Trust indicators */}
            <Card className="border-border/50 bg-section-alt">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Lock className="h-4 w-4 text-primary" />
                            <span>256-bit SSL Encryption</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            <span>PCI DSS Compliant</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-primary" />
                            <span>Powered by Stripe</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
