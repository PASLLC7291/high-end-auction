/**
 * setup-webhooks.ts
 *
 * Registers / updates all webhook (Action Hook) subscriptions with Basta,
 * and documents the full webhook topology for the platform.
 *
 * ---------------------------------------------------------------------------
 * WEBHOOK ARCHITECTURE
 * ---------------------------------------------------------------------------
 *
 * The platform receives webhooks from three external services:
 *
 *   1. Basta  ->  {APP_URL}/api/webhooks/basta
 *      Auth: x-fastbid-webhook-token header (value = BASTA_WEBHOOK_SECRET)
 *            + x-basta-signature HMAC header (verified against same secret)
 *      Events registered via Basta "Action Hook" subscriptions (this script).
 *
 *   2. CJ Dropshipping  ->  {APP_URL}/api/webhooks/cj
 *      Auth: configured in the CJ dashboard (not managed here).
 *      Events: order status changes, logistics/tracking updates.
 *
 *   3. Stripe  ->  {APP_URL}/api/webhooks/stripe
 *      Auth: Stripe webhook signing secret (STRIPE_WEBHOOK_SECRET).
 *      Events: invoice.paid, invoice.payment_succeeded, invoice.payment_failed.
 *      Managed via the Stripe Dashboard or `stripe listen` CLI for local dev.
 *
 * ---------------------------------------------------------------------------
 * BASTA ACTION HOOK EVENTS
 * ---------------------------------------------------------------------------
 *
 *   ActionType               | Purpose
 *   -------------------------+---------------------------------------------
 *   BID_ON_ITEM              | Real-time bid notifications
 *   ITEMS_STATUS_CHANGED     | Item closed -> triggers order/payment flow
 *   SALE_STATUS_CHANGED      | Sale closed -> triggers batch processing
 *   ORDER_CREATED            | Order lifecycle tracking
 *   ORDER_UPDATED            | Order lifecycle tracking
 *   ORDER_CANCELLED          | Order cancelled -> refund flow
 *   SALE_REGISTRATION_CREATED| Bidder registration tracking
 *   USER_UPDATED             | User profile changes (address sync)
 *
 * ---------------------------------------------------------------------------
 * USAGE
 * ---------------------------------------------------------------------------
 *
 *   # Dry-run (default) -- shows what would be registered
 *   pnpm tsx scripts/setup-webhooks.ts
 *
 *   # Actually register / update hooks
 *   pnpm tsx scripts/setup-webhooks.ts --apply
 *
 *   # Override the base URL (useful for staging / ngrok)
 *   pnpm tsx scripts/setup-webhooks.ts --apply --url https://staging.fastbid.co
 *
 *   # Test a single action hook after registering
 *   pnpm tsx scripts/setup-webhooks.ts --apply --test
 *
 * Environment (.env.local):
 *   ACCOUNT_ID             - Basta account ID
 *   API_KEY                - Basta management API key
 *   BASTA_WEBHOOK_SECRET   - Shared secret for webhook verification
 *   APP_URL                - Deployed app base URL (default: https://fastbid.co)
 *   NEXT_PUBLIC_APP_URL    - Fallback if APP_URL is not set
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local (same pattern as other scripts)
config({ path: resolve(process.cwd(), ".env.local") });

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASTA_MANAGEMENT_API =
  process.env.BASTA_MANAGEMENT_API_URL?.trim() ||
  "https://management.api.basta.app/graphql";

const WEBHOOK_TOKEN_HEADER = "x-fastbid-webhook-token";

/**
 * All Basta ActionType enum values we subscribe to.
 * Each maps to a description for logging purposes.
 */
const BASTA_ACTION_TYPES: Record<string, string> = {
  BID_ON_ITEM: "Real-time bid notifications",
  ITEMS_STATUS_CHANGED: "Item closed (triggers order/payment flow)",
  SALE_STATUS_CHANGED: "Sale closed (triggers batch processing)",
  ORDER_CREATED: "Order lifecycle tracking",
  ORDER_UPDATED: "Order lifecycle tracking",
  ORDER_CANCELLED: "Order cancelled (refund flow)",
  SALE_REGISTRATION_CREATED: "Bidder registration tracking",
  USER_UPDATED: "User profile changes (address sync)",
};

// ---------------------------------------------------------------------------
// GraphQL helpers
// ---------------------------------------------------------------------------

type GraphQLResponse<T = unknown> = {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
};

async function gqlRequest<T = unknown>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<GraphQLResponse<T>> {
  const apiKey = process.env.API_KEY?.trim();
  const accountId = process.env.ACCOUNT_ID?.trim();

  if (!apiKey || !accountId) {
    throw new Error("Missing API_KEY or ACCOUNT_ID environment variables");
  }

  const res = await fetch(BASTA_MANAGEMENT_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "x-account-id": accountId,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Basta API HTTP ${res.status}: ${text.slice(0, 500)}`
    );
  }

  return res.json() as Promise<GraphQLResponse<T>>;
}

// ---------------------------------------------------------------------------
// Mutations & Queries
// ---------------------------------------------------------------------------

const ADD_ACTION_HOOK = `
  mutation AddActionHookSubscription($accountId: String!, $input: ActionHookSubscriptionInput!) {
    addActionHookSubscription(accountId: $accountId, input: $input) {
      accountId
      action
      url
      headers {
        key
        value
      }
    }
  }
`;

const LIST_ACTION_HOOKS = `
  query ActionHookSubscriptions($accountId: String!) {
    actionHookSubscriptions(accountId: $accountId) {
      action
      url
      headers {
        key
        value
      }
    }
  }
`;

const TEST_ACTION_HOOK = `
  mutation TestActionHook($accountId: String!, $input: ActionHookSubscriptionInput!) {
    testActionHook(accountId: $accountId, input: $input) {
      statusCode
      error
    }
  }
`;

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

function getArg(name: string): string | null {
  const idx = process.argv.findIndex((a) => a === name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

type ActionHookSub = {
  action: string;
  url: string;
  headers?: Array<{ key: string; value: string } | null> | null;
};

async function listCurrentSubscriptions(
  accountId: string
): Promise<ActionHookSub[]> {
  const res = await gqlRequest<{
    actionHookSubscriptions: ActionHookSub[];
  }>(LIST_ACTION_HOOKS, { accountId });

  if (res.errors?.length) {
    console.warn(
      "Warning: errors querying current subscriptions:",
      res.errors.map((e) => e.message).join("; ")
    );
  }

  return res.data?.actionHookSubscriptions ?? [];
}

async function registerHook(
  accountId: string,
  action: string,
  url: string,
  headers: Array<{ key: string; value: string }>
): Promise<{ success: boolean; error?: string }> {
  const res = await gqlRequest(ADD_ACTION_HOOK, {
    accountId,
    input: {
      action,
      url,
      ...(headers.length > 0 ? { headers } : {}),
    },
  });

  if (res.errors?.length) {
    const msg = res.errors.map((e) => e.message).join("; ");
    return { success: false, error: msg };
  }

  return { success: true };
}

async function testHook(
  accountId: string,
  action: string,
  url: string,
  headers: Array<{ key: string; value: string }>
): Promise<{ statusCode?: number; error?: string }> {
  const res = await gqlRequest<{
    testActionHook: { statusCode?: number; error?: string };
  }>(TEST_ACTION_HOOK, {
    accountId,
    input: {
      action,
      url,
      ...(headers.length > 0 ? { headers } : {}),
    },
  });

  if (res.errors?.length) {
    return { error: res.errors.map((e) => e.message).join("; ") };
  }

  return res.data?.testActionHook ?? { error: "No response from testActionHook" };
}

function printSubscriptionTable(subs: ActionHookSub[]) {
  if (subs.length === 0) {
    console.log("  (none)");
    return;
  }

  // Group by URL for readability
  const byUrl = new Map<string, string[]>();
  for (const sub of subs) {
    const actions = byUrl.get(sub.url) ?? [];
    actions.push(sub.action);
    byUrl.set(sub.url, actions);
  }

  for (const [url, actions] of byUrl) {
    console.log(`  ${url}`);
    for (const action of actions.sort()) {
      const desc = BASTA_ACTION_TYPES[action] ?? "";
      console.log(`    - ${action}${desc ? `  (${desc})` : ""}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const accountId = process.env.ACCOUNT_ID?.trim();
  const apiKey = process.env.API_KEY?.trim();
  const webhookSecret = process.env.BASTA_WEBHOOK_SECRET?.trim();

  if (!accountId || !apiKey) {
    console.error(
      "Error: ACCOUNT_ID and API_KEY must be set in .env.local"
    );
    process.exit(1);
  }

  if (!webhookSecret) {
    console.error(
      "Error: BASTA_WEBHOOK_SECRET must be set in .env.local"
    );
    process.exit(1);
  }

  const urlOverride = getArg("--url");
  const baseUrl = (
    urlOverride ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://fastbid.co"
  ).replace(/\/+$/, ""); // strip trailing slash

  const apply = hasFlag("--apply");
  const runTest = hasFlag("--test");

  const bastaWebhookUrl = `${baseUrl}/api/webhooks/basta`;
  const cjWebhookUrl = `${baseUrl}/api/webhooks/cj`;
  const stripeWebhookUrl = `${baseUrl}/api/webhooks/stripe`;

  // -- Header banner --
  console.log("=".repeat(70));
  console.log("  Webhook Setup — NextGen Auction Platform");
  console.log("=".repeat(70));
  console.log();
  console.log(`  Account ID:      ${accountId}`);
  console.log(`  Management API:  ${BASTA_MANAGEMENT_API}`);
  console.log(`  Base URL:        ${baseUrl}`);
  console.log(`  Mode:            ${apply ? "APPLY (live)" : "DRY RUN"}`);
  console.log();

  // -- Show all webhook endpoints --
  console.log("-".repeat(70));
  console.log("  Webhook Endpoints");
  console.log("-".repeat(70));
  console.log();
  console.log(`  Basta:   ${bastaWebhookUrl}`);
  console.log(`           Auth: ${WEBHOOK_TOKEN_HEADER} header`);
  console.log();
  console.log(`  CJ:      ${cjWebhookUrl}`);
  console.log("           Auth: configured in CJ dashboard (not managed here)");
  console.log();
  console.log(`  Stripe:  ${stripeWebhookUrl}`);
  console.log("           Auth: Stripe webhook signing secret (STRIPE_WEBHOOK_SECRET)");
  console.log("           Managed via Stripe Dashboard or `stripe listen` CLI");
  console.log();

  // -- Fetch current subscriptions --
  console.log("-".repeat(70));
  console.log("  Current Basta Action Hook Subscriptions");
  console.log("-".repeat(70));
  console.log();

  const existingSubs = await listCurrentSubscriptions(accountId);
  printSubscriptionTable(existingSubs);
  console.log();

  // Build a set of already-registered (action, url) pairs for dedup
  const existingSet = new Set(
    existingSubs.map((s) => `${s.action}::${s.url}`)
  );

  // -- Determine what to register --
  const actions = Object.keys(BASTA_ACTION_TYPES);
  const headers = [{ key: WEBHOOK_TOKEN_HEADER, value: webhookSecret }];

  const toRegister: string[] = [];
  const alreadyExists: string[] = [];

  for (const action of actions) {
    if (existingSet.has(`${action}::${bastaWebhookUrl}`)) {
      alreadyExists.push(action);
    } else {
      toRegister.push(action);
    }
  }

  console.log("-".repeat(70));
  console.log("  Registration Plan");
  console.log("-".repeat(70));
  console.log();

  if (alreadyExists.length > 0) {
    console.log(`  Already registered (${alreadyExists.length}):`);
    for (const action of alreadyExists) {
      console.log(`    - ${action}`);
    }
    console.log();
  }

  if (toRegister.length === 0) {
    console.log("  All action hooks are already registered. Nothing to do.");
    console.log();
  } else {
    console.log(`  To register (${toRegister.length}):`);
    for (const action of toRegister) {
      const desc = BASTA_ACTION_TYPES[action];
      console.log(`    + ${action}  (${desc})`);
    }
    console.log();
  }

  // -- Apply if requested --
  if (toRegister.length > 0 && !apply) {
    console.log("  Dry run only. Re-run with --apply to register hooks.");
    console.log();
    return;
  }

  if (toRegister.length > 0 && apply) {
    console.log("-".repeat(70));
    console.log("  Registering Action Hooks");
    console.log("-".repeat(70));
    console.log();

    let successCount = 0;
    let failCount = 0;

    for (const action of toRegister) {
      const result = await registerHook(accountId, action, bastaWebhookUrl, headers);

      if (result.success) {
        successCount++;
        console.log(`  [OK]   ${action}`);
      } else {
        failCount++;
        console.log(`  [FAIL] ${action}: ${result.error}`);
      }
    }

    console.log();
    console.log(
      `  Done: ${successCount} registered, ${failCount} failed, ${alreadyExists.length} already existed.`
    );
    console.log();

    // Re-fetch and display the final state
    console.log("-".repeat(70));
    console.log("  Final Basta Action Hook Subscriptions");
    console.log("-".repeat(70));
    console.log();

    const finalSubs = await listCurrentSubscriptions(accountId);
    printSubscriptionTable(finalSubs);
    console.log();
  }

  // -- Optional: test a hook --
  if (runTest && apply) {
    console.log("-".repeat(70));
    console.log("  Testing Action Hook (BID_ON_ITEM)");
    console.log("-".repeat(70));
    console.log();

    const testResult = await testHook(
      accountId,
      "BID_ON_ITEM",
      bastaWebhookUrl,
      headers
    );

    if (testResult.error) {
      console.log(`  Test FAILED: ${testResult.error}`);
    } else {
      console.log(`  Test response status: ${testResult.statusCode}`);
      if (testResult.statusCode && testResult.statusCode >= 200 && testResult.statusCode < 300) {
        console.log("  Webhook endpoint is reachable and responding correctly.");
      } else {
        console.log("  Webhook endpoint returned a non-2xx status. Check endpoint logs.");
      }
    }
    console.log();
  } else if (runTest && !apply) {
    console.log("  Skipping --test (requires --apply to be set).");
    console.log();
  }

  // -- Summary of manual steps --
  console.log("-".repeat(70));
  console.log("  Manual Steps (not managed by this script)");
  console.log("-".repeat(70));
  console.log();
  console.log("  1. Stripe webhooks:");
  console.log(`     Endpoint:  ${stripeWebhookUrl}`);
  console.log("     Events:    invoice.paid, invoice.payment_succeeded, invoice.payment_failed");
  console.log("     Setup:     Stripe Dashboard > Developers > Webhooks > Add endpoint");
  console.log("     Local dev: stripe listen --forward-to localhost:3000/api/webhooks/stripe");
  console.log();
  console.log("  2. CJ Dropshipping webhooks:");
  console.log(`     Endpoint:  ${cjWebhookUrl}`);
  console.log("     Events:    Order status changes, logistics/tracking updates");
  console.log("     Setup:     CJ Dropshipping Dashboard > Settings > Webhook Configuration");
  console.log();
}

main().catch((error) => {
  console.error("Failed to set up webhooks:", error);
  process.exit(1);
});
