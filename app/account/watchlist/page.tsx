"use client";

import Link from "next/link";
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

// Mock data
const mockWatchlist = [
  {
    id: "1",
    lotId: "lot-1",
    auctionId: "auction-1",
    lotTitle: "Art Deco Diamond Ring",
    auctionTitle: "Fine Jewelry Collection",
    image: "/placeholder.svg",
    currentBid: 3200,
    estimate: { low: 2500, high: 3500 },
    closingDate: "2024-02-16T16:00:00Z",
    lotNumber: 28,
    status: "open",
  },
  {
    id: "2",
    lotId: "lot-2",
    auctionId: "auction-2",
    lotTitle: "Georgian Silver Tea Service",
    auctionTitle: "Silver & Decorative Arts",
    image: "/placeholder.svg",
    currentBid: 1800,
    estimate: { low: 1500, high: 2500 },
    closingDate: "2024-02-17T14:00:00Z",
    lotNumber: 45,
    status: "open",
  },
  {
    id: "3",
    lotId: "lot-3",
    auctionId: "auction-3",
    lotTitle: "Contemporary Bronze Sculpture",
    auctionTitle: "Modern & Contemporary Art",
    image: "/placeholder.svg",
    currentBid: 0,
    estimate: { low: 5000, high: 7000 },
    closingDate: "2024-02-20T12:00:00Z",
    lotNumber: 12,
    status: "upcoming",
  },
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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
  const handleRemove = (id: string) => {
    // Would remove from watchlist via API
    console.log("Remove from watchlist:", id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Watchlist</h2>
        <p className="text-muted-foreground mt-1">
          Items you're following ({mockWatchlist.length})
        </p>
      </div>

      {mockWatchlist.length === 0 ? (
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
          {mockWatchlist.map((item) => (
            <Card key={item.id} className="border-border/50 overflow-hidden group">
              <div className="relative aspect-square bg-muted">
                <img
                  src={item.image}
                  alt={item.lotTitle}
                  className="h-full w-full object-cover"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemove(item.id)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
                <div className="absolute bottom-2 left-2">
                  <Badge variant="secondary" className="bg-background/80">
                    Lot {item.lotNumber}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {item.auctionTitle}
                </p>
                <h3 className="font-medium mt-1 line-clamp-2 min-h-[2.5rem]">
                  {item.lotTitle}
                </h3>

                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimate</span>
                    <span>
                      {formatCurrency(item.estimate.low)} – {formatCurrency(item.estimate.high)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current</span>
                    <span className="font-medium">
                      {item.currentBid > 0 ? formatCurrency(item.currentBid) : "No bids"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-3 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{getTimeRemaining(item.closingDate)}</span>
                </div>

                <div className="flex gap-2 mt-4">
                  <Link href={`/auction/${item.auctionId}/lot/${item.lotId}`} className="flex-1">
                    <Button className="w-full" size="sm">
                      <Gavel className="h-4 w-4 mr-1" />
                      Bid Now
                    </Button>
                  </Link>
                  <Link href={`/auction/${item.auctionId}/lot/${item.lotId}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
