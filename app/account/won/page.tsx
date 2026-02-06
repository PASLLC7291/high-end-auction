"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Receipt,
  Package,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

type WonItemView = {
  saleId: string;
  itemId: string;
  lotNumber?: number;
  lotTitle?: string;
  image?: string;
  hammerPrice?: number | null;
  currency?: string | null;
  itemStatus?: string | null;
  closingDate?: string | null;
};

type WonOrderView = {
  bastaOrderId: string;
  saleId: string;
  auctionTitle?: string;
  status?: string | null;
  invoiceUrl?: string | null;
  createdAt: string;
  items: WonItemView[];
};

function formatCurrency(cents: number | null | undefined, currency: string = "USD") {
  if (cents == null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function getStatusBadge(status?: string | null) {
  switch (status) {
    case "PAID":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    case "INVOICE_ISSUED":
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          <Receipt className="h-3 w-3 mr-1" />
          Invoice Ready
        </Badge>
      );
    case "PAYMENT_FAILED":
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100">
          <AlertCircle className="h-3 w-3 mr-1" />
          Payment Failed
        </Badge>
      );
    case "OPEN":
    default:
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <Package className="h-3 w-3 mr-1" />
          Processing
        </Badge>
      );
  }
}

export default function WonItemsPage() {
  const [orders, setOrders] = useState<WonOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/account/won");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load purchases");
        }
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load purchases");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const items = useMemo(() => orders.flatMap((o) => o.items.map((i) => ({ order: o, item: i }))), [orders]);
  const totalValue = useMemo(() => items.reduce((sum, row) => sum + (row.item.hammerPrice ?? 0), 0), [items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Won Items</h2>
          <p className="text-muted-foreground mt-1">
            {items.length} items • {formatCurrency(totalValue)} total hammer
          </p>
        </div>
      </div>

      {loading ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading won items…</p>
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
          {items.map(({ order, item }) => (
            <Card key={`${order.bastaOrderId}:${item.itemId}`} className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-40 h-40 sm:h-auto bg-muted shrink-0">
                    <img
                      src={item.image || "/placeholder.svg"}
                      alt={item.lotTitle || "Lot image"}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="flex-1 p-4 flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">Lot {item.lotNumber ?? "—"}</Badge>
                        {getStatusBadge(order.status)}
                      </div>
                      <h3 className="font-medium mt-2 line-clamp-1">{item.lotTitle || "Untitled lot"}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {order.auctionTitle || "Auction"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Order {order.bastaOrderId}
                      </p>
                    </div>

                    <div className="sm:text-right shrink-0">
                      <div className="text-sm">
                        <p className="text-muted-foreground">Hammer</p>
                        <p className="text-lg font-semibold">
                          {formatCurrency(item.hammerPrice ?? null, item.currency || "USD")}
                        </p>
                      </div>

                      <div className="flex gap-2 mt-4 sm:justify-end">
                        {order.invoiceUrl && (
                          <Button
                            asChild
                            size="sm"
                            variant={order.status === "PAID" ? "outline" : "default"}
                          >
                            <a href={order.invoiceUrl} target="_blank" rel="noreferrer">
                              {order.status === "PAID" ? "View Invoice" : "Pay / View Invoice"}
                            </a>
                          </Button>
                        )}
                        <Link href={`/auction/${order.saleId}/lot/${item.itemId}`}>
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-3.5 w-3.5" />
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

      {!loading && items.length > 0 && (
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

