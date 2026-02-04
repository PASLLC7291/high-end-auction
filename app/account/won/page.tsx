"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Package,
  Truck,
  CheckCircle,
  Receipt,
  ExternalLink,
} from "lucide-react";

// Mock data
const mockWonItems = [
  {
    id: "1",
    lotId: "lot-1",
    auctionId: "auction-1",
    lotTitle: "French Empire Ormolu Clock",
    auctionTitle: "European Decorative Arts",
    image: "/placeholder.svg",
    hammerPrice: 4200,
    totalPrice: 5250, // Including buyer's premium
    wonDate: "2024-02-01T16:30:00Z",
    lotNumber: 67,
    status: "shipped" as const,
    trackingNumber: "1Z999AA10123456784",
  },
  {
    id: "2",
    lotId: "lot-2",
    auctionId: "auction-2",
    lotTitle: "Pair of Regency Dining Chairs",
    auctionTitle: "Fine Furniture Sale",
    image: "/placeholder.svg",
    hammerPrice: 1800,
    totalPrice: 2250,
    wonDate: "2024-01-28T14:00:00Z",
    lotNumber: 23,
    status: "delivered" as const,
  },
  {
    id: "3",
    lotId: "lot-3",
    auctionId: "auction-3",
    lotTitle: "Sterling Silver Candelabra",
    auctionTitle: "Silver & Objects of Vertu",
    image: "/placeholder.svg",
    hammerPrice: 950,
    totalPrice: 1187,
    wonDate: "2024-02-05T12:00:00Z",
    lotNumber: 112,
    status: "pending" as const,
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
    year: "numeric",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          <Receipt className="h-3 w-3 mr-1" />
          Awaiting Payment
        </Badge>
      );
    case "paid":
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <Package className="h-3 w-3 mr-1" />
          Processing
        </Badge>
      );
    case "shipped":
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
          <Truck className="h-3 w-3 mr-1" />
          Shipped
        </Badge>
      );
    case "delivered":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle className="h-3 w-3 mr-1" />
          Delivered
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function WonItemsPage() {
  const totalValue = mockWonItems.reduce((sum, item) => sum + item.totalPrice, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Won Items</h2>
          <p className="text-muted-foreground mt-1">
            {mockWonItems.length} items • {formatCurrency(totalValue)} total
          </p>
        </div>
      </div>

      {mockWonItems.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h3 className="mt-4 font-medium">No won items yet</h3>
            <p className="mt-2 text-muted-foreground">
              Items you win at auction will appear here
            </p>
            <Link href="/auctions">
              <Button className="mt-6">Browse Auctions</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {mockWonItems.map((item) => (
            <Card key={item.id} className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                  {/* Image */}
                  <div className="sm:w-40 h-40 sm:h-auto bg-muted shrink-0">
                    <img
                      src={item.image}
                      alt={item.lotTitle}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">Lot {item.lotNumber}</Badge>
                        {getStatusBadge(item.status)}
                      </div>
                      <h3 className="font-medium mt-2 line-clamp-1">{item.lotTitle}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {item.auctionTitle}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Won on {formatDate(item.wonDate)}
                      </p>

                      {item.trackingNumber && (
                        <p className="text-sm mt-2">
                          <span className="text-muted-foreground">Tracking: </span>
                          <span className="font-mono">{item.trackingNumber}</span>
                        </p>
                      )}
                    </div>

                    {/* Price & Actions */}
                    <div className="sm:text-right shrink-0">
                      <div className="text-sm">
                        <p className="text-muted-foreground">Hammer Price</p>
                        <p className="font-medium">{formatCurrency(item.hammerPrice)}</p>
                      </div>
                      <div className="text-sm mt-2">
                        <p className="text-muted-foreground">Total (incl. premium)</p>
                        <p className="text-lg font-semibold">{formatCurrency(item.totalPrice)}</p>
                      </div>

                      <div className="flex gap-2 mt-4 sm:justify-end">
                        {item.status === "pending" && (
                          <Button size="sm">
                            Pay Now
                          </Button>
                        )}
                        {item.status === "shipped" && (
                          <Button variant="outline" size="sm">
                            Track Package
                          </Button>
                        )}
                        <Link href={`/auction/${item.auctionId}/lot/${item.lotId}`}>
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-3 w-3" />
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

      {/* Summary Card */}
      {mockWonItems.length > 0 && (
        <Card className="border-border/50 bg-section-alt">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-medium">Need help with your purchases?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Contact our client services team for shipping, payment, or delivery questions.
                </p>
              </div>
              <Link href="/contact">
                <Button variant="outline">Contact Us</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
