"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Truck,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  ExternalLink,
  ShoppingBag,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types – mirrors the API response from GET /api/account/orders
// (sensitive cost / profit fields are already stripped server-side)
// ---------------------------------------------------------------------------

type OrderView = {
  id: string;
  cj_product_name: string;
  cj_variant_name: string | null;
  cj_images: string | null; // JSON-stringified array of image URLs
  status: string;
  winning_bid_cents: number | null;
  tracking_number: string | null;
  tracking_carrier: string | null;
  basta_sale_id: string | null;
  basta_item_id: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(cents: number | null | undefined) {
  if (cents == null) return "";
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

function parseImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getTrackingUrl(trackingNumber: string, carrier: string | null): string {
  // Use AfterShip as a universal tracker
  return `https://track.aftership.com/${trackingNumber}`;
}

// ---------------------------------------------------------------------------
// Status badge logic
// ---------------------------------------------------------------------------

type StatusConfig = {
  label: string;
  icon: React.ElementType;
  className: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
};

function getStatusConfig(status: string): StatusConfig {
  switch (status) {
    case "DELIVERED":
      return {
        label: "Delivered",
        icon: CheckCircle,
        className: "bg-green-100 text-green-700 hover:bg-green-100",
      };
    case "SHIPPED":
      return {
        label: "Shipped",
        icon: Truck,
        className: "bg-green-100 text-green-700 hover:bg-green-100",
      };
    case "CJ_PAID":
      return {
        label: "Order Confirmed",
        icon: Package,
        className: "bg-blue-50 text-blue-700 border-blue-200",
        variant: "outline",
      };
    case "CJ_ORDERED":
      return {
        label: "Processing",
        icon: Clock,
        className: "bg-amber-50 text-amber-700 border-amber-200",
        variant: "outline",
      };
    case "PAID":
      return {
        label: "Payment Received",
        icon: CheckCircle,
        className: "bg-blue-50 text-blue-700 border-blue-200",
        variant: "outline",
      };
    case "AUCTION_CLOSED":
      return {
        label: "Awaiting Payment",
        icon: Clock,
        className: "bg-amber-50 text-amber-700 border-amber-200",
        variant: "outline",
      };
    case "PAYMENT_FAILED":
      return {
        label: "Payment Failed",
        icon: AlertCircle,
        className: "bg-red-100 text-red-700 hover:bg-red-100",
        variant: "destructive",
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        icon: XCircle,
        className: "bg-red-100 text-red-700 hover:bg-red-100",
        variant: "destructive",
      };
    case "CJ_OUT_OF_STOCK":
      return {
        label: "Out of Stock",
        icon: AlertCircle,
        className: "bg-red-100 text-red-700 hover:bg-red-100",
        variant: "destructive",
      };
    case "CJ_PRICE_CHANGED":
      return {
        label: "Under Review",
        icon: AlertCircle,
        className: "bg-amber-50 text-amber-700 border-amber-200",
        variant: "outline",
      };
    case "RESERVE_NOT_MET":
      return {
        label: "Reserve Not Met",
        icon: XCircle,
        className: "bg-gray-100 text-gray-600 hover:bg-gray-100",
        variant: "secondary",
      };
    default:
      return {
        label: status.replace(/_/g, " "),
        icon: Package,
        className: "bg-gray-100 text-gray-600",
        variant: "secondary",
      };
  }
}

function StatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status);
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/account/orders");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load orders");
        }
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load orders");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">My Orders</h2>
        <p className="text-muted-foreground mt-1">
          Track your won auction lots, payments, and shipping
        </p>
      </div>

      {/* Loading */}
      {loading ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading orders...</p>
          </CardContent>
        </Card>
      ) : error ? (
        /* Error */
        <Card className="border-border/50">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : orders.length === 0 ? (
        /* Empty state */
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h3 className="mt-4 font-medium">No orders yet</h3>
            <p className="mt-2 text-muted-foreground">
              Win an auction to see your orders here.
            </p>
            <Link href="/auctions">
              <Button className="mt-6">Browse Auctions</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        /* Order list */
        <div className="space-y-4">
          {orders.map((order) => {
            const images = parseImages(order.cj_images);
            const thumbnail = images[0] || null;

            return (
              <Card
                key={order.id}
                className="border-border/50 overflow-hidden"
              >
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    {/* Thumbnail */}
                    <div className="sm:w-40 h-40 sm:h-auto bg-muted shrink-0 relative">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={order.cj_product_name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "/placeholder.svg";
                          }}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Package className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 p-4 flex flex-col sm:flex-row gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Status badge */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={order.status} />
                        </div>

                        {/* Product name */}
                        <h3 className="font-medium mt-2 line-clamp-2">
                          {order.cj_product_name}
                        </h3>
                        {order.cj_variant_name && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {order.cj_variant_name}
                          </p>
                        )}

                        {/* Tracking info */}
                        {order.tracking_number && (
                          <div className="mt-3 flex items-center gap-2 text-sm">
                            <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground">
                              {order.tracking_carrier
                                ? `${order.tracking_carrier}: `
                                : "Tracking: "}
                            </span>
                            <a
                              href={getTrackingUrl(
                                order.tracking_number,
                                order.tracking_carrier
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline font-mono text-xs break-all"
                            >
                              {order.tracking_number}
                              <ExternalLink className="h-3 w-3 inline ml-1" />
                            </a>
                          </div>
                        )}

                        {/* Date */}
                        <p className="text-xs text-muted-foreground mt-2">
                          Ordered {formatDate(order.created_at)}
                        </p>
                      </div>

                      {/* Price */}
                      <div className="sm:text-right shrink-0">
                        <div className="text-sm">
                          <p className="text-muted-foreground">Amount</p>
                          <p className="text-lg font-semibold">
                            {order.winning_bid_cents
                              ? formatCurrency(order.winning_bid_cents)
                              : "--"}
                          </p>
                        </div>

                        {/* Link to lot detail if available */}
                        {order.basta_sale_id && order.basta_item_id && (
                          <div className="mt-4 sm:flex sm:justify-end">
                            <Link
                              href={`/auction/${order.basta_sale_id}/lot/${order.basta_item_id}`}
                            >
                              <Button variant="outline" size="sm">
                                View Lot
                                <ExternalLink className="h-3.5 w-3.5 ml-1" />
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Help card (matches won page pattern) */}
      {!loading && orders.length > 0 && (
        <Card className="border-border/50 bg-section-alt">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-medium">Need help with an order?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Contact our client services team for shipping, payment, or
                  delivery questions.
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
