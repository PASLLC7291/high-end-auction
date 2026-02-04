"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  Clock,
  Trash2,
  ExternalLink,
  Gavel,
} from "lucide-react";

type WatchlistItem = {
  id: string;
  saleId: string;
  itemId: string;
  lotNumber?: number;
  lotTitle?: string;
  auctionTitle?: string;
  image?: string;
  currency?: string | null;
  currentBid?: number | null;
  startingBid?: number | null;
  lowEstimate?: number | null;
  highEstimate?: number | null;
  closingDate?: string | null;
  status?: string;
};

function formatCurrency(cents: number, currency: string = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function getTimeRemaining(dateString: string) {
  const now = new Date();
  const end = new Date(dateString);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h remaining`;
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const count = useMemo(() => items.length, [items.length]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/account/watchlist");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load watchlist");
        }
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load watchlist");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleRemove = async (saleId: string, itemId: string) => {
    try {
      const res = await fetch("/api/account/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId, itemId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove item");
      }
      setItems((prev) => prev.filter((i) => !(i.saleId === saleId && i.itemId === itemId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Watchlist</h2>
        <p className="text-muted-foreground mt-1">
          Items you're following ({count})
        </p>
      </div>

      {loading ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading watchlist…</p>
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
      ) : items.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <Heart className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h3 className="mt-4 font-medium">Your watchlist is empty</h3>
            <p className="mt-2 text-muted-foreground">
              Save items you're interested in to track them here
            </p>
            <Link href="/auctions">
              <Button className="mt-6">Browse Auctions</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const currency = item.currency || "USD";
            return (
              <Card key={item.id} className="border-border/50 overflow-hidden group">
              <div className="relative aspect-square bg-muted">
                <img
                  src={item.image || "/placeholder.svg"}
                  alt={item.lotTitle || "Lot image"}
                  className="h-full w-full object-cover"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemove(item.saleId, item.itemId)}
                  title="Remove from watchlist"
                  aria-label="Remove from watchlist"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
                <div className="absolute bottom-2 left-2">
                  <Badge variant="secondary" className="bg-background/80">
                    Lot {item.lotNumber ?? "—"}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {item.auctionTitle || "Auction"}
                </p>
                <h3 className="font-medium mt-1 line-clamp-2 min-h-[2.5rem]">
                  {item.lotTitle || "Untitled lot"}
                </h3>

                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimate</span>
                    <span>
                      {item.lowEstimate != null && item.highEstimate != null
                        ? `${formatCurrency(item.lowEstimate, currency)} – ${formatCurrency(item.highEstimate, currency)}`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current</span>
                    <span className="font-medium">
                      {(item.currentBid ?? 0) > 0
                        ? formatCurrency(item.currentBid as number, currency)
                        : item.startingBid
                          ? `Start ${formatCurrency(item.startingBid, currency)}`
                          : "No bids"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-3 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{item.closingDate ? getTimeRemaining(item.closingDate) : "—"}</span>
                </div>

                <div className="flex gap-2 mt-4">
                  <Link href={`/auction/${item.saleId}/lot/${item.itemId}`} className="flex-1">
                    <Button className="w-full" size="sm">
                      <Gavel className="h-4 w-4 mr-1" />
                      Bid Now
                    </Button>
                  </Link>
                  <Link href={`/auction/${item.saleId}/lot/${item.itemId}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
