/**
 * CJ Dropshipping Webhook Handler
 *
 * Receives order status and logistics updates from CJ Dropshipping.
 * Updates the dropship_lots table with shipping/tracking information.
 *
 * CJ webhook types:
 * - order: Order status changes (CREATED → UNSHIPPED → SHIPPED → DELIVERED)
 * - logistics: Tracking number assignment and delivery updates
 */

import { NextRequest, NextResponse } from "next/server";
import { markWebhookProcessed } from "@/lib/db";
import {
  getDropshipLotByCjOrder,
  updateDropshipLot,
} from "@/lib/dropship";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // CJ webhooks don't have a standard idempotency key,
    // so we generate one from the payload
    const idempotencyKey =
      payload.requestId ??
      `cj-${payload.orderId ?? payload.trackNumber ?? Date.now()}`;

    const processed = await markWebhookProcessed("cj", idempotencyKey, payload);
    if (!processed) {
      return NextResponse.json({ status: "ignored" });
    }

    // Route based on webhook content
    if (payload.orderId && payload.orderStatus) {
      await handleOrderUpdate(payload);
    }

    if (payload.trackNumber || payload.trackingNumber) {
      await handleLogisticsUpdate(payload);
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("CJ webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleOrderUpdate(payload: {
  orderId: string;
  orderStatus: string;
  trackNumber?: string;
  logisticName?: string;
}) {
  const lot = await getDropshipLotByCjOrder(payload.orderId);
  if (!lot) {
    console.log(
      `[cj-webhook] No lot found for CJ order ${payload.orderId}, ignoring`
    );
    return;
  }

  const updates: Record<string, string | null> = {
    cj_order_status: payload.orderStatus,
  };

  // Map CJ status to our lot status
  switch (payload.orderStatus) {
    case "SHIPPED":
      updates.status = "SHIPPED";
      if (payload.trackNumber) {
        updates.tracking_number = payload.trackNumber;
      }
      if (payload.logisticName) {
        updates.tracking_carrier = payload.logisticName;
      }
      break;
    case "DELIVERED":
      updates.status = "DELIVERED";
      break;
    case "CANCELLED":
      updates.status = "CANCELLED";
      updates.error_message = "CJ order was cancelled";
      break;
  }

  await updateDropshipLot(lot.id, updates);
  console.log(
    `[cj-webhook] Lot ${lot.id} updated: CJ status → ${payload.orderStatus}`
  );
}

async function handleLogisticsUpdate(payload: {
  orderId?: string;
  trackNumber?: string;
  trackingNumber?: string;
  logisticName?: string;
  trackingStatus?: string;
  deliveryTime?: string;
}) {
  const trackNum = payload.trackNumber ?? payload.trackingNumber;
  if (!trackNum) return;

  // Find the lot by CJ order ID if available
  if (!payload.orderId) return;

  const lot = await getDropshipLotByCjOrder(payload.orderId);
  if (!lot) return;

  const updates: Record<string, string | null> = {
    tracking_number: trackNum,
  };

  if (payload.logisticName) {
    updates.tracking_carrier = payload.logisticName;
  }

  if (payload.trackingStatus === "DELIVERED" || payload.deliveryTime) {
    updates.status = "DELIVERED";
    updates.cj_order_status = "DELIVERED";
  } else if (!lot.tracking_number) {
    // First time we get a tracking number → mark as shipped
    updates.status = "SHIPPED";
    updates.cj_order_status = "SHIPPED";
  }

  await updateDropshipLot(lot.id, updates);
  console.log(
    `[cj-webhook] Lot ${lot.id} tracking updated: ${trackNum}`
  );
}
