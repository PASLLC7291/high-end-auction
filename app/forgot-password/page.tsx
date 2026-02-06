"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Mail, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Always show success to prevent email enumeration
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-section-alt flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to sign in
        </Link>

        <Card className="border-border/50 shadow-lg">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Reset your password</h1>
              <p className="text-sm text-muted-foreground">
                Enter your email and we’ll show you the next step.
              </p>
            </div>

            {submitted ? (
              <Alert>
                <AlertTitle>Check your inbox</AlertTitle>
                <AlertDescription>
                  If an account exists for <span className="font-medium">{email || "that email"}</span>, you’ll
                  receive password reset instructions shortly.
                  <div className="mt-3">
                    <Link href="/login">
                      <Button variant="outline" size="sm">
                        Return to sign in
                      </Button>
                    </Link>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Continue"}
                </Button>
              </form>
            )}

            <p className="text-xs text-muted-foreground">
              Having trouble?{" "}
              <Link href="/contact" className="text-primary hover:underline">
                Contact support
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

