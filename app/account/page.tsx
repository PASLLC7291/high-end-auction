"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Gavel,
  Heart,
  Trophy,
  CreditCard,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Clock,
  Shield,
  TrendingUp,
} from "lucide-react";

// Mock data - in production this would come from API
const mockStats = {
  activeBids: 3,
  watchlistItems: 12,
  wonItems: 5,
  totalSpent: 15750,
};

const mockRecentBids = [
  {
    id: "1",
    lotTitle: "19th Century Mahogany Writing Desk",
    auctionTitle: "Fine Furniture & Decorative Arts",
    currentBid: 2500,
    yourBid: 2200,
    status: "outbid",
    closingDate: "2024-02-15T14:00:00Z",
  },
  {
    id: "2",
    lotTitle: "Tiffany & Co. Art Nouveau Brooch",
    auctionTitle: "Fine Jewelry Collection",
    currentBid: 4800,
    yourBid: 4800,
    status: "winning",
    closingDate: "2024-02-16T16:00:00Z",
  },
  {
    id: "3",
    lotTitle: "Rare First Edition Hemingway",
    auctionTitle: "Books & Manuscripts",
    currentBid: 1200,
    yourBid: 1200,
    status: "winning",
    closingDate: "2024-02-17T12:00:00Z",
  },
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export default function AccountOverviewPage() {
  const { data: session } = useSession();
  const hasPaymentMethod = true; // This would come from API

  return (
    <div className="space-y-8">
      {/* Welcome Message */}
      <div>
        <h2 className="text-2xl font-semibold">
          Welcome back{session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}
        </h2>
        <p className="text-muted-foreground mt-1">
          Here's an overview of your account activity
        </p>
      </div>

      {/* Account Status */}
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

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Gavel className="h-5 w-5 text-primary" />
              </div>
              <span className="text-2xl font-semibold">{mockStats.activeBids}</span>
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
              <span className="text-2xl font-semibold">{mockStats.watchlistItems}</span>
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
              <span className="text-2xl font-semibold">{mockStats.wonItems}</span>
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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-2xl font-semibold">{formatCurrency(mockStats.totalSpent)}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Total Purchases</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Bids */}
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
          {mockRecentBids.length === 0 ? (
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
              {mockRecentBids.map((bid) => (
                <div
                  key={bid.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{bid.lotTitle}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {bid.auctionTitle}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-2 justify-end">
                      {bid.status === "winning" ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Winning
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Outbid
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm mt-1">
                      <span className="text-muted-foreground">Your bid:</span>{" "}
                      <span className="font-medium">{formatCurrency(bid.yourBid)}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
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
                  Update your password and security settings
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

      {/* Trust Footer */}
      <div className="flex flex-wrap items-center justify-center gap-6 py-6 text-sm text-muted-foreground border-t border-border">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span>Secure Account</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-primary" />
          <span>Verified Bidder</span>
        </div>
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <span>Encrypted Payments</span>
        </div>
      </div>
    </div>
  );
}
