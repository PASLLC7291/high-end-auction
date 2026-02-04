import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local (same pattern as other scripts)
config({ path: resolve(process.cwd(), ".env.local") });

import { getAccountId, getManagementApiClient } from "../lib/basta-client";

type ActionHookSubscription = {
  action: string;
  url: string;
  headers?: Array<{ key: string; value: string } | null> | null;
};

function getArg(name: string): string | null {
  const idx = process.argv.findIndex((a) => a === name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function usage(): never {
  console.error(
    [
      "Usage:",
      "  tsx scripts/sync-basta-webhooks.ts --url <https://your-site.com/api/webhooks/basta> [--apply]",
      "",
      "Notes:",
      "  - Default is dry-run (prints what would change).",
      "  - Requires .env.local with ACCOUNT_ID + API_KEY.",
    ].join("\n")
  );
  process.exit(1);
}

async function main() {
  const url = getArg("--url") || process.env.BASTA_WEBHOOK_URL || null;
  const apply = hasFlag("--apply");

  if (!url) usage();

  const client = getManagementApiClient();
  const accountId = getAccountId();

  const res = (await client.query({
    actionHookSubscriptions: {
      __args: { accountId },
      action: true,
      url: true,
      headers: { key: true, value: true },
    },
  })) as unknown as { actionHookSubscriptions?: ActionHookSubscription[] };

  const subs = res.actionHookSubscriptions ?? [];
  if (subs.length === 0) {
    console.log("No action hook subscriptions found for this account.");
    return;
  }

  const changes = subs.filter((s) => s.url !== url);

  console.log(`Target URL: ${url}`);
  console.log(`Found ${subs.length} subscriptions (${changes.length} to update).`);

  if (!apply) {
    for (const s of changes) {
      console.log(`- ${s.action}: ${s.url} -> ${url}`);
    }
    console.log("\nDry run only. Re-run with --apply to update.");
    return;
  }

  for (const s of changes) {
    const headers = (s.headers ?? []).filter(Boolean).map((h) => ({
      key: h!.key,
      value: h!.value,
    }));

    await client.mutation({
      updateActionHookSubscription: {
        __args: {
          accountId,
          input: {
            // Action types can evolve (dashboard may contain newer actions than the SDK types).
            // We use the server-provided value and cast to avoid blocking sync.
            action: s.action as any,
            url,
            ...(headers.length ? { headers } : {}),
          },
        },
        action: true,
        url: true,
      },
    });

    console.log(`✓ Updated ${s.action}`);
  }
}

main().catch((error) => {
  console.error("Failed to sync Basta webhooks:", error);
  process.exit(1);
});

