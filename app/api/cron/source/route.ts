/**
 * Vercel Cron endpoint — runs daily to auto-source products using keyword rotation.
 *
 * Picks the next keyword from the sourcing_keywords table (oldest last_sourced_at,
 * highest priority), runs the sourcing pipeline, and records the result.
 *
 * Auth: Bearer token matching CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { getNextKeyword, markKeywordSourced } from "@/lib/sourcing-keywords";
import { runAutoSource } from "@/lib/pipeline";
import { sendAlert } from "@/lib/alerts";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get next keyword to source
  const keyword = await getNextKeyword();

  if (!keyword) {
    console.log("[cron/source] No active sourcing keywords configured.");
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "No active sourcing keywords",
    });
  }

  console.log(
    `[cron/source] Selected keyword: "${keyword.keyword}" (id: ${keyword.id}, priority: ${keyword.priority}, runs: ${keyword.total_runs})`
  );

  try {
    const result = await runAutoSource({
      keyword: keyword.keyword,
      maxCostUsd: keyword.max_cost_usd,
      maxProducts: keyword.max_products,
      publish: true,
    });

    // Record the sourcing run
    await markKeywordSourced(keyword.id, result.lotsCreated);

    console.log(
      `[cron/source] Done: keyword="${result.keyword}" sale=${result.saleId} lots=${result.lotsCreated}`
    );

    return NextResponse.json({
      ok: true,
      keyword: result.keyword,
      saleId: result.saleId,
      lotsCreated: result.lotsCreated,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[cron/source] Failed for keyword "${keyword.keyword}":`, e);

    // Still mark as sourced to prevent the same keyword from blocking rotation
    await markKeywordSourced(keyword.id, 0);

    await sendAlert(
      `Auto-source failed for keyword "${keyword.keyword}": ${message}`
    );

    return NextResponse.json(
      { ok: false, error: message, keyword: keyword.keyword },
      { status: 500 }
    );
  }
}
