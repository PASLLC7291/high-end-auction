/**
 * Vercel Cron endpoint — runs every 10 minutes to catch missed webhooks,
 * retry failed fulfillments, and process auto-refunds.
 *
 * Auth: Bearer token matching CRON_SECRET env var.
 * Each step has independent try/catch so one failure doesn't block others.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  pollAndProcessClosedSales,
  retryFailedFulfillments,
  processRefunds,
} from "@/lib/pipeline";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // Step 1: Poll for closed sales (catch missed webhooks)
  try {
    results.poll = await pollAndProcessClosedSales();
  } catch (e) {
    console.error("[cron] pollAndProcessClosedSales failed:", e);
    results.poll = { error: e instanceof Error ? e.message : String(e) };
  }

  // Step 2: Retry failed fulfillments (PAID lots without CJ orders)
  try {
    results.fulfillment = await retryFailedFulfillments();
  } catch (e) {
    console.error("[cron] retryFailedFulfillments failed:", e);
    results.fulfillment = { error: e instanceof Error ? e.message : String(e) };
  }

  // Step 3: Auto-refund CJ failures (CJ_OUT_OF_STOCK, CJ_PRICE_CHANGED)
  try {
    results.refund = await processRefunds();
  } catch (e) {
    console.error("[cron] processRefunds failed:", e);
    results.refund = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({ ok: true, results });
}
