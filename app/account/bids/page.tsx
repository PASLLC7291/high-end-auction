"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Gavel,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
} from "lucide-react";

type BidItem = {
  saleId: string;
  itemId: string;
  lotNumber?: number;
  lotTitle?: string;
  auctionTitle?: string;
  image?: string;
  currency?: string | null;
  currentBid?: number | null;
  yourBid?: number;
  yourMaxBid?: number;
  bidStatus?: string | null;
  itemStatus?: string | null;
  closingDate?: string | null;
  lastBidDate?: string;
};

function formatCurrency(cents: number | null | undefined, currency: string = "USD") {
  if (cents == null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTimeRemaining(dateString: string) {
  const now = new Date();
  const end = new Date(dateString);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function isPastStatus(itemStatus?: string | null): boolean {
  return Boolean(
    itemStatus &&
      [
        "ITEM_CLOSED",
        "ITEM_SOLD",
        "ITEM_WITHDRAWN",
        "ITEM_PASSED",
        "ITEM_PROCESSING",
      ].includes(itemStatus)
  );
}

function isOutbid(bidStatus?: string | null): boolean {
  return bidStatus === "LOSING" || bidStatus === "LOST";
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

export default function BidsPage() {
  const [items, setItems] = useState<BidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/account/bids");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load bids");
        }
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load bids");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const activeBids = useMemo(() => items.filter((b) => !isPastStatus(b.itemStatus)), [items]);
  const pastBids = useMemo(() => items.filter((b) => isPastStatus(b.itemStatus)), [items]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">My Bids</h2>
        <p className="text-muted-foreground mt-1">
          Track your active bids and bid history
        </p>
      </div>

      {loading ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading bids…</p>
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
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active ({activeBids.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({pastBids.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {activeBids.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-12 text-center">
                  <Gavel className="h-12 w-12 mx-auto text-muted-foreground/40" />
                  <h3 className="mt-4 font-medium">No active bids</h3>
                  <p className="mt-2 text-muted-foreground">
                    You haven't placed any bids yet
                  </p>
                  <Link href="/auctions">
                    <Button className="mt-6">Browse Auctions</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {activeBids.map((bid) => {
                  const currency = bid.currency || "USD";
                  const outbid = isOutbid(bid.bidStatus);
                  const badge = getBidBadge(bid.bidStatus);

                  return (
                    <Card
                      key={`${bid.saleId}:${bid.itemId}`}
                      className="border-border/50 overflow-hidden"
                    >
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row">
                          <div className="sm:w-32 h-32 sm:h-auto bg-muted shrink-0">
                            <img
                              src={bid.image || "/placeholder.svg"}
                              alt={bid.lotTitle || "Lot image"}
                              className="h-full w-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                            />
                          </div>

                          <div className="flex-1 p-4 flex flex-col sm:flex-row gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2 flex-wrap">
                                <Badge variant="outline" className="shrink-0">
                                  Lot {bid.lotNumber ?? "—"}
                                </Badge>
                                {badge.tone === "winning" ? (
                                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    {badge.label}
                                  </Badge>
                                ) : badge.tone === "outbid" ? (
                                  <Badge
                                    variant="destructive"
                                    className="bg-red-100 text-red-700 hover:bg-red-100"
                                  >
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    {badge.label}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">{badge.label}</Badge>
                                )}
                              </div>
                              <h3 className="font-medium mt-2 line-clamp-1">
                                {bid.lotTitle || "Untitled lot"}
                              </h3>
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {bid.auctionTitle || "Auction"}
                              </p>

                              <div className="flex items-center gap-4 mt-3 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Current: </span>
                                  <span className="font-medium">
                                    {formatCurrency(bid.currentBid, currency)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Your max: </span>
                                  <span className="font-medium">
                                    {formatCurrency(bid.yourMaxBid ?? bid.yourBid ?? null, currency)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="sm:text-right shrink-0">
                              <div className="flex items-center gap-1 text-sm text-muted-foreground sm:justify-end">
                                <Clock className="h-4 w-4" />
                                <span>
                                  {bid.closingDate ? getTimeRemaining(bid.closingDate) : "—"}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {bid.closingDate ? `Closes ${formatDate(bid.closingDate)}` : ""}
                              </p>
                              <div className="flex gap-2 mt-3 sm:justify-end">
                                {outbid && (
                                  <Link href={`/auction/${bid.saleId}/lot/${bid.itemId}`}>
                                    <Button size="sm">Increase Bid</Button>
                                  </Link>
                                )}
                                <Link href={`/auction/${bid.saleId}/lot/${bid.itemId}`}>
                                  <Button variant="outline" size="sm">
                                    View Lot
                                    <ExternalLink className="h-3 w-3 ml-1" />
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-6">
            {pastBids.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/40" />
                  <h3 className="mt-4 font-medium">No past bids</h3>
                  <p className="mt-2 text-muted-foreground">
                    Your closed bids will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pastBids.map((bid) => (
                  <Card
                    key={`${bid.saleId}:${bid.itemId}`}
                    className="border-border/50 overflow-hidden"
                  >
                    <CardContent className="p-0">
                      <div className="flex flex-col sm:flex-row">
                        <div className="sm:w-32 h-32 sm:h-auto bg-muted shrink-0">
                          <img
                            src={bid.image || "/placeholder.svg"}
                            alt={bid.lotTitle || "Lot image"}
                            className="h-full w-full object-cover opacity-75"
                          />
                        </div>
                        <div className="flex-1 p-4">
                          <div className="flex items-start gap-2">
                            <Badge variant="outline">Lot {bid.lotNumber ?? "—"}</Badge>
                            <Badge variant="secondary">Ended</Badge>
                          </div>
                          <h3 className="font-medium mt-2">{bid.lotTitle || "Untitled lot"}</h3>
                          <p className="text-sm text-muted-foreground">
                            {bid.auctionTitle || "Auction"}
                          </p>
                          <div className="flex items-center gap-4 mt-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Final: </span>
                              <span className="font-medium">
                                {formatCurrency(bid.currentBid ?? null, bid.currency || "USD")}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Your max: </span>
                              <span className="font-medium">
                                {formatCurrency(bid.yourMaxBid ?? bid.yourBid ?? null, bid.currency || "USD")}
                              </span>
                            </div>
                          </div>
                          <div className="mt-4">
                            <Link href={`/auction/${bid.saleId}/lot/${bid.itemId}`}>
                              <Button variant="outline" size="sm">
                                View Lot
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
