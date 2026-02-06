/**
 * CJ Dropshipping Webhook Handler
 *
 * Receives order status and logistics updates from CJ Dropshipping.
 * Updates the dropship_lots table with shipping/tracking information.
 *
 * CJ webhook types:
 * - order: Order status changes (CREATED → UNSHIPPED → SHIPPED → DELIVERED)
 * - logistics: Tracking number assignment and delivery updates
 *
 * Authentication:
 * - Requires CJ_WEBHOOK_SECRET env var to be set.
 * - Validates the secret against either:
 *     1. x-cj-signature header (timing-safe comparison), or
 *     2. Authorization: Bearer <secret> header
 * - Additionally validates that the orderId in the payload corresponds to
 *   an existing dropship_lots row before processing.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { markWebhookProcessed } from "@/lib/db";
import {
  getDropshipLotByCjOrder,
  updateDropshipLot,
} from "@/lib/dropship";
import { sendEmail } from "@/lib/email";
import { getUserById } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Authentication helpers
// ---------------------------------------------------------------------------

function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Verify the webhook request is authentic.
 *
 * Accepts either:
 *   - x-cj-signature header that matches CJ_WEBHOOK_SECRET
 *   - Authorization: Bearer <CJ_WEBHOOK_SECRET>
 *
 * All comparisons use timing-safe equality to prevent timing attacks.
 */
function verifyWebhookAuth(request: NextRequest, secret: string): boolean {
  // Option 1: x-cj-signature header
  const signatureHeader = request.headers.get("x-cj-signature")?.trim();
  if (signatureHeader) {
    try {
      return timingSafeEqualStrings(signatureHeader, secret);
    } catch {
      return false;
    }
  }

  // Option 2: Authorization: Bearer <secret>
  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) {
      try {
        return timingSafeEqualStrings(match[1], secret);
      } catch {
        return false;
      }
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // -----------------------------------------------------------------------
    // Step 1: Authenticate the request
    // -----------------------------------------------------------------------
    const secret = process.env.CJ_WEBHOOK_SECRET?.trim();
    if (!secret) {
      console.error("[cj-webhook] CJ_WEBHOOK_SECRET is not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    if (!verifyWebhookAuth(request, secret)) {
      console.warn("[cj-webhook] Unauthorized webhook attempt");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // -----------------------------------------------------------------------
    // Step 2: Parse payload and check idempotency
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    // Step 3: Validate that the orderId maps to a known dropship lot
    // -----------------------------------------------------------------------
    const orderId = payload.orderId;
    if (!orderId) {
      console.warn("[cj-webhook] Payload missing orderId, rejecting");
      return NextResponse.json(
        { error: "Missing orderId" },
        { status: 400 }
      );
    }

    const lot = await getDropshipLotByCjOrder(orderId);
    if (!lot) {
      console.warn(
        `[cj-webhook] No dropship lot found for CJ order ${orderId}, rejecting`
      );
      return NextResponse.json(
        { error: "Unknown order" },
        { status: 404 }
      );
    }

    // -----------------------------------------------------------------------
    // Step 4: Route based on webhook content (lot is pre-validated)
    // -----------------------------------------------------------------------
    if (payload.orderId && payload.orderStatus) {
      await handleOrderUpdate(payload, lot);
    }

    if (payload.trackNumber || payload.trackingNumber) {
      await handleLogisticsUpdate(payload, lot);
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

async function handleOrderUpdate(
  payload: {
    orderId: string;
    orderStatus: string;
    trackNumber?: string;
    logisticName?: string;
  },
  lot: Awaited<ReturnType<typeof getDropshipLotByCjOrder>> & object
) {
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

  // Fire-and-forget: send lifecycle emails to buyer.
  // NOTE: Emails are ONLY sent from handleOrderUpdate (not handleLogisticsUpdate)
  // to prevent duplicate emails when both handlers fire for the same webhook.
  if (lot.winner_user_id && (payload.orderStatus === "SHIPPED" || payload.orderStatus === "DELIVERED")) {
    getUserById(lot.winner_user_id)
      .then((user) => {
        if (!user?.email) return;
        if (payload.orderStatus === "SHIPPED") {
          sendEmail({
            to: user.email,
            template: "order_shipped",
            data: {
              productName: lot.cj_product_name,
              trackingNumber: payload.trackNumber ?? lot.tracking_number,
              trackingCarrier: payload.logisticName ?? lot.tracking_carrier,
            },
          });
        } else if (payload.orderStatus === "DELIVERED") {
          sendEmail({
            to: user.email,
            template: "order_delivered",
            data: {
              productName: lot.cj_product_name,
            },
          });
        }
      })
      .catch((e) =>
        console.warn(`[email] Failed to send email for lot ${lot.id}:`, e)
      );
  }
}

/**
 * Handle logistics/tracking updates from CJ.
 *
 * This handler ONLY updates tracking data (number, carrier, status).
 * It does NOT send emails — all lifecycle emails are sent exclusively
 * from handleOrderUpdate to prevent duplicate notifications.
 */
async function handleLogisticsUpdate(
  payload: {
    orderId?: string;
    trackNumber?: string;
    trackingNumber?: string;
    logisticName?: string;
    trackingStatus?: string;
    deliveryTime?: string;
  },
  lot: Awaited<ReturnType<typeof getDropshipLotByCjOrder>> & object
) {
  const trackNum = payload.trackNumber ?? payload.trackingNumber;
  if (!trackNum) return;

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
