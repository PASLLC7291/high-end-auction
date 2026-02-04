"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RedeemBalanceForm } from "@/components/balance/redeem-balance-form";
import {
  Gavel,
  Heart,
  Trophy,
  CreditCard,
  Wallet,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Shield,
  TrendingUp,
} from "lucide-react";

type OverviewResponse = {
  stats: {
    activeBids: number;
    watchlistItems: number;
    wonItems: number;
  };
  hasPaymentMethod: boolean;
  recentBids: Array<{
    saleId: string;
    itemId: string;
    auctionTitle?: string;
    lotTitle?: string;
    lotNumber?: number;
    currency?: string | null;
    currentBid?: number | null;
    yourMaxBid?: number;
    bidStatus?: string | null;
    closingDate?: string | null;
  }>;
};

type BalanceResponse = {
  balanceCents: number;
  currency?: string;
};

function formatCurrency(cents: number | null | undefined, currency: string = "USD") {
  if (cents == null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function getBidBadge(status?: string | null) {
  if (status === "WINNING" || status === "WON") {
    return { tone: "winning" as const, label: "Winning" };
  }
  if (status === "LOSING" || status === "LOST") {
    return { tone: "outbid" as const, label: "Outbid" };
  }
  if (status === "SUBMITTED") {
    return { tone: "submitted" as const, label: "Submitted" };
  }
  return { tone: "placed" as const, label: "Bid placed" };
}

export default function AccountOverviewPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [overviewRes, balanceRes] = await Promise.all([
          fetch("/api/account/overview"),
          fetch("/api/account/balance"),
        ]);

        const overviewJson = await overviewRes.json();
        if (!overviewRes.ok) {
          throw new Error(overviewJson.error || "Failed to load account overview");
        }
        setData(overviewJson as OverviewResponse);

        if (balanceRes.ok) {
          const balanceJson = (await balanceRes.json()) as BalanceResponse;
          setBalance(balanceJson);
        } else {
          setBalance(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load account overview");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const firstName = useMemo(() => session?.user?.name?.split(" ")?.[0], [session?.user?.name]);

  const stats = data?.stats ?? { activeBids: 0, watchlistItems: 0, wonItems: 0 };
  const hasPaymentMethod = Boolean(data?.hasPaymentMethod);
  const recentBids = data?.recentBids ?? [];
  const balanceDisplay = balance ? formatCurrency(balance.balanceCents, balance.currency || "USD") : "—";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">
          Welcome back{firstName ? `, ${firstName}` : ""}
        </h2>
        <p className="text-muted-foreground mt-1">
          Here's an overview of your account activity
        </p>
      </div>

      {loading ? (
        <Card className="border-border/50">
          <CardContent className="py-10 text-center">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading account overview…</p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-border/50">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {!hasPaymentMethod && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-900">Complete your account setup</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Add a payment method to start bidding on auctions.
                    </p>
                    <Link href="/account/payment">
                      <Button size="sm" className="mt-3">
                        Add Payment Method
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Gavel className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-2xl font-semibold">{stats.activeBids}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Active Bids</p>
                <Link
                  href="/account/bids"
                  className="mt-2 inline-flex items-center text-sm text-primary hover:underline"
                >
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100">
                    <Heart className="h-5 w-5 text-pink-600" />
                  </div>
                  <span className="text-2xl font-semibold">{stats.watchlistItems}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Watchlist Items</p>
                <Link
                  href="/account/watchlist"
                  className="mt-2 inline-flex items-center text-sm text-primary hover:underline"
                >
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                    <Trophy className="h-5 w-5 text-amber-600" />
                  </div>
                  <span className="text-2xl font-semibold">{stats.wonItems}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Won Items</p>
                <Link
                  href="/account/won"
                  className="mt-2 inline-flex items-center text-sm text-primary hover:underline"
                >
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                    <Wallet className="h-5 w-5 text-indigo-600" />
                  </div>
                  <span className="text-2xl font-semibold">{balanceDisplay}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Balance</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Applied automatically to invoices
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                    <CreditCard className="h-5 w-5 text-green-600" />
                  </div>
                  <span className="text-2xl font-semibold">{hasPaymentMethod ? "Yes" : "No"}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Payment Method</p>
                <Link
                  href="/account/payment"
                  className="mt-2 inline-flex items-center text-sm text-primary hover:underline"
                >
                  Manage <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Promo Code</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <RedeemBalanceForm onRedeemed={(next) => setBalance(next)} />
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Recent Bids</CardTitle>
                <Link href="/account/bids">
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {recentBids.length === 0 ? (
                <div className="text-center py-8">
                  <Gavel className="h-12 w-12 mx-auto text-muted-foreground/40" />
                  <p className="mt-4 text-muted-foreground">No bids yet</p>
                  <Link href="/auctions">
                    <Button variant="outline" className="mt-4">
                      Browse Auctions
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentBids.map((bid) => (
                    <Link
                      key={`${bid.saleId}:${bid.itemId}`}
                      href={`/auction/${bid.saleId}/lot/${bid.itemId}`}
                      className="block"
                    >
                      <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{bid.lotTitle || "Untitled lot"}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {bid.auctionTitle || "Auction"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-2 justify-end">
                            {getBidBadge(bid.bidStatus).tone === "winning" ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {getBidBadge(bid.bidStatus).label}
                              </Badge>
                            ) : getBidBadge(bid.bidStatus).tone === "outbid" ? (
                              <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {getBidBadge(bid.bidStatus).label}
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                {getBidBadge(bid.bidStatus).label}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm mt-1">
                            <span className="text-muted-foreground">Your max:</span>{" "}
                            <span className="font-medium">
                              {formatCurrency(bid.yourMaxBid ?? null, bid.currency || "USD")}
                            </span>
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Payment Methods</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage your payment methods for bidding
                    </p>
                    <Link href="/account/payment">
                      <Button variant="outline" size="sm" className="mt-4">
                        Manage
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <Shield className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Account Security</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Update your password and notification preferences
                    </p>
                    <Link href="/account/settings">
                      <Button variant="outline" size="sm" className="mt-4">
                        Settings
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 py-6 text-sm text-muted-foreground border-t border-border">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span>Secure Account</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span>{hasPaymentMethod ? "Payment Verified" : "Payment Needed"}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span>Live Bidding</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
