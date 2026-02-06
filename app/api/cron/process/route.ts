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
  getFinancialSummary,
  checkCjQuota,
  handleStuckLots,
} from "@/lib/pipeline";
import { sendAlert } from "@/lib/alerts";

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
    await sendAlert(`pollAndProcessClosedSales failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Step 2: Retry failed fulfillments (PAID lots without CJ orders)
  try {
    results.fulfillment = await retryFailedFulfillments();
  } catch (e) {
    console.error("[cron] retryFailedFulfillments failed:", e);
    results.fulfillment = { error: e instanceof Error ? e.message : String(e) };
    await sendAlert(`retryFailedFulfillments failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Step 3: Auto-refund CJ failures (CJ_OUT_OF_STOCK, CJ_PRICE_CHANGED)
  try {
    results.refund = await processRefunds();
  } catch (e) {
    console.error("[cron] processRefunds failed:", e);
    results.refund = { error: e instanceof Error ? e.message : String(e) };
    await sendAlert(`processRefunds failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Step 4: Attach financial summary
  try {
    results.financials = await getFinancialSummary();
  } catch (e) {
    console.error("[cron] getFinancialSummary failed:", e);
    results.financials = { error: e instanceof Error ? e.message : String(e) };
  }

  // Step 5: Check CJ API quota and alert if critically low
  try {
    const quotaReport = await checkCjQuota();
    results.quota = quotaReport;

    if (!quotaReport.healthy) {
      const lowEndpoints = quotaReport.criticallyLow
        .map((q) => `${q.endpoint} (${q.remaining} remaining)`)
        .join(", ");
      await sendAlert(
        `CJ API quota critically low: ${lowEndpoints}`,
        "critical"
      );
    }
  } catch (e) {
    console.error("[cron] checkCjQuota failed:", e);
    results.quota = { error: e instanceof Error ? e.message : String(e) };
  }

  // Step 6: Detect and recover stuck lots
  try {
    results.stuckLots = await handleStuckLots();
  } catch (e) {
    console.error("[cron] handleStuckLots failed:", e);
    results.stuckLots = { error: e instanceof Error ? e.message : String(e) };
    await sendAlert(`handleStuckLots failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return NextResponse.json({ ok: true, results });
}
