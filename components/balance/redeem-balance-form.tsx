"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type RedeemResponse =
  | { success: true; message?: string; balanceCents: number; currency?: string }
  | { success?: false; error?: string };

export function RedeemBalanceForm({
  onRedeemed,
}: {
  onRedeemed?: (next: { balanceCents: number; currency?: string }) => void;
}) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/balance/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as RedeemResponse;

      if (!res.ok) {
        const message = "error" in data && data.error ? data.error : "Unable to redeem code.";
        throw new Error(message);
      }

      if (!("success" in data) || !data.success) {
        throw new Error("Unable to redeem code.");
      }

      toast({
        title: data.message || "Balance updated",
        description: "Your balance will be applied automatically to invoices.",
      });

      setCode("");
      onRedeemed?.({ balanceCents: data.balanceCents, currency: data.currency });
    } catch (error) {
      toast({
        title: "Redeem failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="balance-promo-code">Promo code</Label>
        <div className="flex gap-2">
          <Input
            id="balance-promo-code"
            placeholder="Enter code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={submitting}
            autoComplete="off"
          />
          <Button type="submit" disabled={submitting || !code.trim()}>
            {submitting ? "Applying..." : "Apply"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Applied automatically to invoices at checkout.
      </p>
    </form>
  );
}

