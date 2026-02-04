"use client";

import { useState } from "react";
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
  ArrowRight,
  ExternalLink,
} from "lucide-react";

// Mock data
const mockBids = [
  {
    id: "1",
    lotId: "lot-1",
    auctionId: "auction-1",
    lotTitle: "19th Century Mahogany Writing Desk",
    auctionTitle: "Fine Furniture & Decorative Arts",
    image: "/placeholder.svg",
    currentBid: 2500,
    yourBid: 2200,
    yourMaxBid: 3000,
    status: "outbid" as const,
    closingDate: "2024-02-15T14:00:00Z",
    lotNumber: 42,
  },
  {
    id: "2",
    lotId: "lot-2",
    auctionId: "auction-1",
    lotTitle: "Tiffany & Co. Art Nouveau Brooch",
    auctionTitle: "Fine Jewelry Collection",
    image: "/placeholder.svg",
    currentBid: 4800,
    yourBid: 4800,
    yourMaxBid: 5500,
    status: "winning" as const,
    closingDate: "2024-02-16T16:00:00Z",
    lotNumber: 15,
  },
  {
    id: "3",
    lotId: "lot-3",
    auctionId: "auction-2",
    lotTitle: "Rare First Edition Hemingway",
    auctionTitle: "Books & Manuscripts",
    image: "/placeholder.svg",
    currentBid: 1200,
    yourBid: 1200,
    yourMaxBid: 1500,
    status: "winning" as const,
    closingDate: "2024-02-17T12:00:00Z",
    lotNumber: 8,
  },
  {
    id: "4",
    lotId: "lot-4",
    auctionId: "auction-3",
    lotTitle: "Ming Dynasty Porcelain Vase",
    auctionTitle: "Asian Art & Antiques",
    image: "/placeholder.svg",
    currentBid: 8500,
    yourBid: 7200,
    yourMaxBid: 7200,
    status: "closed" as const,
    closingDate: "2024-02-10T14:00:00Z",
    lotNumber: 23,
    won: false,
  },
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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

export default function BidsPage() {
  const activeBids = mockBids.filter((b) => b.status !== "closed");
  const pastBids = mockBids.filter((b) => b.status === "closed");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">My Bids</h2>
        <p className="text-muted-foreground mt-1">
          Track your active bids and bid history
        </p>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active ({activeBids.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Past ({pastBids.length})
          </TabsTrigger>
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
              {activeBids.map((bid) => (
                <Card key={bid.id} className="border-border/50 overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row">
                      {/* Image */}
                      <div className="sm:w-32 h-32 sm:h-auto bg-muted shrink-0">
                        <img
                          src={bid.image}
                          alt={bid.lotTitle}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-4 flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 flex-wrap">
                            <Badge variant="outline" className="shrink-0">
                              Lot {bid.lotNumber}
                            </Badge>
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
                          <h3 className="font-medium mt-2 line-clamp-1">{bid.lotTitle}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {bid.auctionTitle}
                          </p>

                          <div className="flex items-center gap-4 mt-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Current: </span>
                              <span className="font-medium">{formatCurrency(bid.currentBid)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Your max: </span>
                              <span className="font-medium">{formatCurrency(bid.yourMaxBid)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Time & Actions */}
                        <div className="sm:text-right shrink-0">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground sm:justify-end">
                            <Clock className="h-4 w-4" />
                            <span>{getTimeRemaining(bid.closingDate)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Closes {formatDate(bid.closingDate)}
                          </p>
                          <div className="flex gap-2 mt-3 sm:justify-end">
                            {bid.status === "outbid" && (
                              <Link href={`/auction/${bid.auctionId}/lot/${bid.lotId}`}>
                                <Button size="sm">
                                  Increase Bid
                                </Button>
                              </Link>
                            )}
                            <Link href={`/auction/${bid.auctionId}/lot/${bid.lotId}`}>
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
              ))}
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
                <Card key={bid.id} className="border-border/50 overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row">
                      <div className="sm:w-32 h-32 sm:h-auto bg-muted shrink-0">
                        <img
                          src={bid.image}
                          alt={bid.lotTitle}
                          className="h-full w-full object-cover opacity-75"
                        />
                      </div>
                      <div className="flex-1 p-4">
                        <div className="flex items-start gap-2">
                          <Badge variant="outline">Lot {bid.lotNumber}</Badge>
                          <Badge variant="secondary">Ended</Badge>
                        </div>
                        <h3 className="font-medium mt-2">{bid.lotTitle}</h3>
                        <p className="text-sm text-muted-foreground">{bid.auctionTitle}</p>
                        <div className="flex items-center gap-4 mt-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Final: </span>
                            <span className="font-medium">{formatCurrency(bid.currentBid)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Your bid: </span>
                            <span className="font-medium">{formatCurrency(bid.yourBid)}</span>
                          </div>
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
    </div>
  );
}
