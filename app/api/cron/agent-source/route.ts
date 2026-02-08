/**
 * Agent-driven cron endpoint — runs the Sourcing Agent daily at 8 AM UTC.
 *
 * Replaces the manual keyword rotation + auto-source in /api/cron/source
 * with an autonomous agent that decides whether and what to source.
 *
 * Auth: Bearer token matching CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent/harness";
import { getAgentConfig } from "@/lib/agent/agents";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAgent({
    agentConfig: getAgentConfig("sourcing"),
    initialMessage:
      "Run your sourcing cycle. Check inventory levels, evaluate CJ API quota, review keyword rotation, and decide whether to source new products.",
    triggerType: "scheduled",
    triggerDetail: "cron:agent-source",
  });

  return NextResponse.json({
    ok: result.status !== "failed",
    correlationId: result.correlationId,
    status: result.status,
    turns: result.totalTurns,
    toolCalls: result.totalToolCalls,
    summary: result.summary.slice(0, 500),
    error: result.error,
  });
}
