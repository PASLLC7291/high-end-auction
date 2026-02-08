/**
 * auctionctl — CLI for the autonomous agent harness.
 *
 * Commands:
 *   run <agent>     Run an agent (ops, sourcing, strategy)
 *   cron            Run ops + sourcing agents in sequence
 *   status          Show pipeline status dashboard
 *   runs            Show recent agent runs
 *   decisions       Show decisions for a run
 *   breakers        Show/reset circuit breakers
 *   shadow on|off   Toggle global shadow mode
 *   replay <run-id> Replay a run's decision chain
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load env before any lib imports
config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

import { runAgent } from "@/lib/agent/harness";
import { getAgentConfig, listAgents } from "@/lib/agent/agents";
import {
  getRecentRuns,
  getDecisionsForRun,
  getRunById,
} from "@/lib/agent/decision-ledger";
import {
  getBreakerState,
  resetBreaker,
  getAllBreakerStates,
  initBreakerState,
} from "@/lib/agent/circuit-breakers";
import { getStatusDashboard, getFinancialSummary, checkCjQuota } from "@/lib/pipeline";
import { db } from "@/lib/turso";
import type { AgentId } from "@/lib/agent/types";

// ---------------------------------------------------------------------------
// Argument Parsing
// ---------------------------------------------------------------------------

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx === process.argv.length - 1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function commandRun(): Promise<void> {
  const agentId = process.argv[3] as AgentId | undefined;
  if (!agentId || !listAgents().includes(agentId)) {
    console.error(`Usage: auctionctl run <${listAgents().join("|")}>`);
    console.error(`  Options: --shadow, --max-turns <N>`);
    process.exitCode = 1;
    return;
  }

  const shadowMode = hasFlag("--shadow");
  const maxTurnsStr = getArg("--max-turns");
  const agentConfig = { ...getAgentConfig(agentId) };

  if (maxTurnsStr) {
    agentConfig.maxTurns = parseInt(maxTurnsStr, 10);
  }

  // Build initial message based on agent type
  const initialMessages: Record<AgentId, string> = {
    ops: "Run your standard operations cycle. Check the dashboard, process closed sales, handle failures, retry fulfillments, check quota, and report on financial health.",
    sourcing:
      "Run your sourcing cycle. Check inventory levels, evaluate CJ API quota, review keyword rotation, and decide whether to source new products.",
    strategy:
      "Analyze current business performance and provide a comprehensive strategic report with data-backed recommendations.",
  };

  console.log(`\n--- auctionctl run ${agentId} ---`);
  console.log(`Shadow mode: ${shadowMode}`);
  console.log(`Max turns: ${agentConfig.maxTurns}`);
  console.log(`Model: ${agentConfig.model}`);
  console.log(`Tools: ${agentConfig.toolNames.length}`);
  console.log("");

  const result = await runAgent({
    agentConfig,
    initialMessage: initialMessages[agentId],
    triggerType: "manual",
    triggerDetail: "cli:auctionctl",
    shadowModeOverride: shadowMode,
  });

  console.log(`\n--- Run Complete ---`);
  console.log(`Status: ${result.status}`);
  console.log(`Turns: ${result.totalTurns}`);
  console.log(`Tool calls: ${result.totalToolCalls}`);
  console.log(`Correlation ID: ${result.correlationId}`);
  if (result.error) console.log(`Error: ${result.error}`);
  console.log(`\n--- Summary ---`);
  console.log(result.summary);
}

async function commandCron(): Promise<void> {
  const shadowMode = hasFlag("--shadow");

  console.log(`\n--- auctionctl cron ---`);
  console.log(`Shadow mode: ${shadowMode}`);
  console.log("");

  // Run ops agent
  console.log("=== Phase 1: Operations Agent ===");
  const opsResult = await runAgent({
    agentConfig: getAgentConfig("ops"),
    initialMessage:
      "Run your standard operations cycle. Check the dashboard, process closed sales, handle failures, retry fulfillments, check quota, and report on financial health.",
    triggerType: "scheduled",
    triggerDetail: "cli:cron",
    shadowModeOverride: shadowMode,
  });
  console.log(`Ops: ${opsResult.status} (${opsResult.totalTurns} turns, ${opsResult.totalToolCalls} tool calls)`);

  // Run sourcing agent
  console.log("\n=== Phase 2: Sourcing Agent ===");
  const sourcingResult = await runAgent({
    agentConfig: getAgentConfig("sourcing"),
    initialMessage:
      "Run your sourcing cycle. Check inventory levels, evaluate CJ API quota, review keyword rotation, and decide whether to source new products.",
    triggerType: "scheduled",
    triggerDetail: "cli:cron",
    shadowModeOverride: shadowMode,
  });
  console.log(`Sourcing: ${sourcingResult.status} (${sourcingResult.totalTurns} turns, ${sourcingResult.totalToolCalls} tool calls)`);

  console.log("\n--- Cron Complete ---");
  console.log(`Ops: ${opsResult.status} | Sourcing: ${sourcingResult.status}`);
}

async function commandStatus(): Promise<void> {
  console.log("\n--- Pipeline Status ---\n");

  const dashboard = await getStatusDashboard();

  // Lot counts by status
  console.log("Lot Counts:");
  for (const [status, count] of Object.entries(dashboard.byStatus)) {
    console.log(`  ${status.padEnd(20)} ${count}`);
  }
  console.log(`  ${"TOTAL".padEnd(20)} ${dashboard.total}`);

  // Stuck lots
  if (dashboard.stuck.length > 0) {
    console.log(`\nStuck Lots (${dashboard.stuck.length}):`);
    for (const lot of dashboard.stuck) {
      console.log(`  ${lot.id.slice(0, 8)}  ${lot.status.padEnd(16)} ${lot.cj_product_name.slice(0, 40)}`);
    }
  }

  // Failed lots
  if (dashboard.failed.length > 0) {
    console.log(`\nFailed Lots (${dashboard.failed.length}):`);
    for (const lot of dashboard.failed.slice(0, 10)) {
      console.log(
        `  ${lot.id.slice(0, 8)}  ${lot.status.padEnd(20)} ${(lot.error_message ?? "").slice(0, 40)}`
      );
    }
    if (dashboard.failed.length > 10) {
      console.log(`  ... and ${dashboard.failed.length - 10} more`);
    }
  }

  // Financials
  const f = dashboard.financials;
  console.log("\nFinancials:");
  console.log(`  Revenue:   $${(f.totalRevenue / 100).toFixed(2)}`);
  console.log(`  Cost:      $${(f.totalCost / 100).toFixed(2)}`);
  console.log(`  Profit:    $${(f.totalProfit / 100).toFixed(2)}`);
  console.log(`  Margin:    ${f.profitMargin.toFixed(1)}%`);
  console.log(`  Sold:      ${f.lotsSold}`);
  console.log(`  Delivered: ${f.lotsDelivered}`);
  console.log(`  Refunds:   ${f.refundCount} ($${(f.refundAmount / 100).toFixed(2)})`);

  // Quota
  try {
    const quota = await checkCjQuota();
    console.log("\nCJ API Quota:");
    for (const q of quota.quotas) {
      const status = q.remaining < 100 ? "CRITICAL" : q.remaining < 200 ? "LOW" : "OK";
      console.log(
        `  ${q.endpoint.padEnd(40)} ${String(q.remaining).padStart(5)} remaining  [${status}]`
      );
    }
  } catch {
    console.log("\nCJ API Quota: Unable to check (CJ_API_KEY may not be set)");
  }
}

async function commandRuns(): Promise<void> {
  const agentFilter = getArg("--agent") as AgentId | undefined;
  const lastN = parseInt(getArg("--last") ?? "10", 10);

  const runs = await getRecentRuns({
    agentId: agentFilter,
    limit: lastN,
  });

  if (runs.length === 0) {
    console.log("No agent runs found.");
    return;
  }

  console.log(`\n--- Recent Runs (${runs.length}) ---\n`);
  console.log(
    `${"ID".padEnd(10)} ${"Agent".padEnd(10)} ${"Trigger".padEnd(12)} ${"Status".padEnd(12)} ${"Turns".padStart(6)} ${"Tools".padStart(6)} ${"Started".padEnd(20)}`
  );
  console.log("-".repeat(85));

  for (const run of runs) {
    console.log(
      `${run.id.slice(0, 8).padEnd(10)} ${run.agent_id.padEnd(10)} ${run.trigger_type.padEnd(12)} ${run.status.padEnd(12)} ${String(run.total_turns).padStart(6)} ${String(run.total_tool_calls).padStart(6)} ${run.started_at.slice(0, 19).padEnd(20)}`
    );
  }
}

async function commandDecisions(): Promise<void> {
  let runId = getArg("--run-id");

  if (!runId) {
    // Get most recent run
    const runs = await getRecentRuns({ limit: 1 });
    if (runs.length === 0) {
      console.log("No runs found.");
      return;
    }
    runId = runs[0].id;
    console.log(`Using most recent run: ${runId.slice(0, 8)}`);
  }

  const decisions = await getDecisionsForRun(runId);

  if (decisions.length === 0) {
    console.log(`No decisions found for run ${runId.slice(0, 8)}`);
    return;
  }

  console.log(`\n--- Decisions for run ${runId.slice(0, 8)} (${decisions.length}) ---\n`);
  console.log(
    `${"Turn".padStart(5)} ${"Tool".padEnd(30)} ${"Shadow".padEnd(8)} ${"Duration".padStart(8)} ${"Reasoning".padEnd(50)}`
  );
  console.log("-".repeat(105));

  for (const d of decisions) {
    const reasoning = (d.reasoning ?? "").replace(/\n/g, " ").slice(0, 48);
    const shadow = d.shadow_mode ? "yes" : "no";
    console.log(
      `${String(d.turn_number).padStart(5)} ${(d.tool_name ?? "(reasoning)").padEnd(30)} ${shadow.padEnd(8)} ${String(d.duration_ms).padStart(6)}ms ${reasoning.padEnd(50)}`
    );
  }
}

async function commandBreakers(): Promise<void> {
  const resetName = getArg("--reset");

  if (resetName) {
    await resetBreaker(resetName);
    console.log(`Breaker "${resetName}" has been reset.`);
    return;
  }

  await initBreakerState();
  const states = await getAllBreakerStates();

  console.log(`\n--- Circuit Breakers ---\n`);
  console.log(
    `${"Breaker".padEnd(28)} ${"Value".padStart(8)} ${"Tripped".padEnd(9)} ${"Last Reset".padEnd(20)}`
  );
  console.log("-".repeat(70));

  for (const s of states) {
    console.log(
      `${s.breakerName.padEnd(28)} ${String(s.currentValue).padStart(8)} ${(s.tripped ? "YES" : "no").padEnd(9)} ${(s.lastResetAt ?? "never").slice(0, 19).padEnd(20)}`
    );
  }
}

async function commandShadow(): Promise<void> {
  const action = process.argv[3];

  if (action === "on") {
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT OR REPLACE INTO circuit_breaker_state (breaker_name, current_value, last_reset_at, tripped, tripped_at, updated_at)
            VALUES ('global_shadow_mode', 0, ?, 1, ?, ?)`,
      args: [now, now, now],
    });
    console.log("Global shadow mode: ON");
    console.log("All agent runs will now operate in shadow mode regardless of config.");
  } else if (action === "off") {
    const now = new Date().toISOString();
    await db.execute({
      sql: `UPDATE circuit_breaker_state SET tripped = 0, updated_at = ? WHERE breaker_name = 'global_shadow_mode'`,
      args: [now],
    });
    console.log("Global shadow mode: OFF");
    console.log("Agents will use their configured shadow mode setting.");
  } else {
    console.error("Usage: auctionctl shadow <on|off>");
    process.exitCode = 1;
  }
}

async function commandReplay(): Promise<void> {
  const runId = process.argv[3];
  if (!runId) {
    console.error("Usage: auctionctl replay <run-id>");
    process.exitCode = 1;
    return;
  }

  const run = await getRunById(runId);
  if (!run) {
    console.error(`Run not found: ${runId}`);
    process.exitCode = 1;
    return;
  }

  const decisions = await getDecisionsForRun(runId);

  console.log(`\n--- Replay: ${runId.slice(0, 8)} ---`);
  console.log(`Agent: ${run.agent_id}`);
  console.log(`Trigger: ${run.trigger_type} (${run.trigger_detail})`);
  console.log(`Shadow: ${run.shadow_mode ? "yes" : "no"}`);
  console.log(`Status: ${run.status}`);
  console.log(`Turns: ${run.total_turns} | Tool calls: ${run.total_tool_calls}`);
  console.log(`Started: ${run.started_at}`);
  console.log(`Completed: ${run.completed_at ?? "N/A"}`);
  if (run.error) console.log(`Error: ${run.error}`);
  console.log("");

  for (const d of decisions) {
    console.log(`=== Turn ${d.turn_number} ===`);

    if (d.reasoning) {
      console.log(`Reasoning: ${d.reasoning.slice(0, 500)}`);
    }

    if (d.tool_name) {
      console.log(`Tool: ${d.tool_name}`);
      if (d.tool_args) {
        try {
          const args = JSON.parse(d.tool_args);
          console.log(`Args: ${JSON.stringify(args, null, 2).slice(0, 300)}`);
        } catch {
          console.log(`Args: ${d.tool_args.slice(0, 300)}`);
        }
      }
      if (d.circuit_breaker_tripped) {
        console.log(`BREAKER TRIPPED: ${d.circuit_breaker_tripped}`);
      }
      if (d.tool_result) {
        console.log(`Result: ${d.tool_result.slice(0, 300)}`);
      }
      console.log(`Duration: ${d.duration_ms}ms`);
    }

    console.log("");
  }

  if (run.summary) {
    console.log("=== Summary ===");
    console.log(run.summary.slice(0, 1000));
  }
}

// ---------------------------------------------------------------------------
// Main Dispatch
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case "run":
      await commandRun();
      break;
    case "cron":
      await commandCron();
      break;
    case "status":
      await commandStatus();
      break;
    case "runs":
      await commandRuns();
      break;
    case "decisions":
      await commandDecisions();
      break;
    case "breakers":
      await commandBreakers();
      break;
    case "shadow":
      await commandShadow();
      break;
    case "replay":
      await commandReplay();
      break;
    default:
      console.log(`
auctionctl — Autonomous Agent Harness CLI

Commands:
  run <agent>        Run an agent (${listAgents().join(", ")})
                     Options: --shadow, --max-turns <N>
  cron               Run ops + sourcing in sequence
                     Options: --shadow
  status             Show pipeline status dashboard
  runs               Show recent agent runs
                     Options: --agent <id>, --last <N>
  decisions          Show decisions for a run
                     Options: --run-id <id>
  breakers           Show circuit breaker states
                     Options: --reset <breaker-name>
  shadow on|off      Toggle global shadow mode
  replay <run-id>    Replay a run's decision chain
`);
      break;
  }
}

main().catch((error) => {
  console.error("auctionctl error:", error);
  process.exitCode = 1;
});
