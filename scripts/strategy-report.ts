/**
 * strategy-report.ts — Lightweight single-call Claude strategy analysis.
 *
 * Pre-fetches all pipeline data, sends it in a single API call to Claude,
 * and prints the analysis to stdout. No agent loop, no tool calling.
 *
 * Usage: ANTHROPIC_API_KEY=<key> pnpm strategy:report
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import Anthropic from "@anthropic-ai/sdk";
import { getStatusDashboard, getFinancialSummary, checkCjQuota } from "../lib/pipeline";
import { getDropshipLotStatusCounts } from "../lib/dropship";
import { listKeywords } from "../lib/sourcing-keywords";

const STRATEGY_PROMPT = `You are the Strategy Analyst for Placer Auctions, a dropship auction platform.

Analyze the provided pipeline data and produce a structured business report.

## Analysis Framework

1. **Financial Health**: Revenue, cost, profit, margin (target: >10%, warning: <5%, critical: <0%), refund rate (target: <10%, warning: >15%)
2. **Inventory Pipeline**: Lot distribution across statuses, bottlenecks, active inventory (LISTED + PUBLISHED)
3. **Sourcing Efficiency**: Keyword rotation health, gaps in coverage
4. **CJ API Quota**: Current usage, projected days until exhaustion
5. **Risk Factors**: Issues needing immediate attention

## Output Format

### Executive Summary
2-3 sentences on overall health.

### Financial Analysis
Key metrics with comparisons to targets.

### Pipeline Analysis
Current state, velocity, bottlenecks.

### Recommendations
Numbered list of specific, actionable recommendations with data backing.

### Risk Factors
Any issues needing immediate attention.`;

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.error("Missing ANTHROPIC_API_KEY. Set it in .env.local or as an env var.");
    process.exit(1);
  }

  console.log("Gathering pipeline data...\n");

  const [dashboard, financials, quota, statusCounts, keywords] = await Promise.all([
    getStatusDashboard(),
    getFinancialSummary(),
    checkCjQuota().catch(() => null),
    getDropshipLotStatusCounts(),
    listKeywords(),
  ]);

  const data = {
    dashboard: {
      totalLots: dashboard.total,
      byStatus: dashboard.byStatus,
      stuckLots: dashboard.stuck.length,
      failedLots: dashboard.failed.length,
    },
    financials,
    quota,
    statusCounts,
    keywords: keywords.map((k) => ({
      keyword: k.keyword,
      active: k.active,
      totalRuns: k.total_runs,
      totalLots: k.total_lots_created,
      lastSourced: k.last_sourced_at,
    })),
  };

  console.log("Requesting strategy analysis from Claude...\n");

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: STRATEGY_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is the current pipeline data:\n\n${JSON.stringify(data, null, 2)}\n\nPlease provide your analysis.`,
      },
    ],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  console.log("═══════════════════════════════════════════════════════════");
  console.log("                   STRATEGY REPORT");
  console.log("═══════════════════════════════════════════════════════════\n");
  console.log(text);
  console.log("\n═══════════════════════════════════════════════════════════");
}

main().catch((e) => {
  console.error("Strategy report failed:", e);
  process.exit(1);
});
