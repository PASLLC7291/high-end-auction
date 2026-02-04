"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export function NewsletterSignup() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/marketing/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "Unable to subscribe.");
      }

      toast({
        title: data.message || "Subscribed!",
        description: "You'll get auction alerts and collecting insights.",
      });
      setEmail("");
    } catch (error) {
      toast({
        title: "Subscription failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="mt-3 flex gap-2" onSubmit={handleSubmit}>
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <Input
        id="newsletter-email"
        type="email"
        placeholder="Enter your email"
        className="flex-1"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={submitting}
        autoComplete="email"
      />
      <Button type="submit" size="default" disabled={submitting}>
        {submitting ? "Subscribing..." : "Subscribe"}
      </Button>
    </form>
  );
}

