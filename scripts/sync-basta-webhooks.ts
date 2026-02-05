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

const WEBHOOK_TOKEN_HEADER = "x-fastbid-webhook-token";

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
  const token = process.env.BASTA_WEBHOOK_SECRET?.trim() || null;

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

  const headerKeyLower = WEBHOOK_TOKEN_HEADER.toLowerCase();
  const normalizeHeaders = (headers: ActionHookSubscription["headers"]) =>
    (headers ?? [])
      .filter(Boolean)
      .map((h) => ({ key: h!.key, value: h!.value }))
      .filter((h) => h.key.trim().length > 0);

  const ensureAuthHeader = (headers: Array<{ key: string; value: string }>) => {
    if (!token) return headers;
    const filtered = headers.filter((h) => h.key.trim().toLowerCase() !== headerKeyLower);
    return [...filtered, { key: WEBHOOK_TOKEN_HEADER, value: token }];
  };

  const needsAuthHeaderUpdate = (headers: Array<{ key: string; value: string }>) => {
    if (!token) return false;
    const existing = headers.find((h) => h.key.trim().toLowerCase() === headerKeyLower);
    return !existing || existing.value !== token;
  };

  const changes = subs
    .map((s) => {
      const currentHeaders = normalizeHeaders(s.headers);
      const desiredHeaders = ensureAuthHeader(currentHeaders);
      const urlChanged = s.url !== url;
      const headersChanged = needsAuthHeaderUpdate(currentHeaders);
      return { sub: s, urlChanged, headersChanged, desiredHeaders };
    })
    .filter((c) => c.urlChanged || c.headersChanged);

  console.log(`Target URL: ${url}`);
  console.log(`Found ${subs.length} subscriptions (${changes.length} to update).`);
  if (token) {
    console.log(`Auth header: ${WEBHOOK_TOKEN_HEADER} (value from BASTA_WEBHOOK_SECRET)`);
  } else {
    console.log(
      `Auth header: skipped (set BASTA_WEBHOOK_SECRET to also attach ${WEBHOOK_TOKEN_HEADER} to subscriptions)`
    );
  }

  if (!apply) {
    for (const c of changes) {
      const s = c.sub;
      const parts: string[] = [];
      if (c.urlChanged) parts.push(`url ${s.url} -> ${url}`);
      if (c.headersChanged) parts.push(`set ${WEBHOOK_TOKEN_HEADER}`);
      console.log(`- ${s.action}: ${parts.join(", ")}`);
    }
    console.log("\nDry run only. Re-run with --apply to update.");
    return;
  }

  for (const c of changes) {
    const s = c.sub;
    const headers = c.desiredHeaders;

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
