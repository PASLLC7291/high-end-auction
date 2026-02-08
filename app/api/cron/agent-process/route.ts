/**
 * Agent-driven cron endpoint — runs the Operations Agent every 10 minutes.
 *
 * Replaces the manual pipeline steps in /api/cron/process with an autonomous
 * agent that decides what to do based on the current state.
 *
 * Auth: Bearer token matching CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent/harness";
import { getAgentConfig } from "@/lib/agent/agents";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentConfig = {
    ...getAgentConfig("ops"),
    maxTurns: 10, // Constrain for cron time limits
  };

  const result = await runAgent({
    agentConfig,
    initialMessage:
      "Run your standard operations cycle. Check the dashboard, process closed sales, handle failures, retry fulfillments, check quota, and report on financial health.",
    triggerType: "scheduled",
    triggerDetail: "cron:agent-process",
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
