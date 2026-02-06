import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { CJClient } from "../lib/cj-client";

async function main() {
  const cj = new CJClient(process.env.CJ_API_KEY!);
  const settings = await cj.getSettings() as {
    setting: {
      quotaLimits: Array<{
        quotaUrl: string;
        quotaLimit: number;
        requestedNum: number;
        quotaType: number;
      }>;
    };
  };

  const quotaTypeLabels: Record<number, string> = {
    0: "TOTAL",
    1: "yearly",
    2: "quarterly",
    3: "monthly",
    4: "daily",
    5: "hourly",
  };

  console.log("Endpoint                              Used / Limit   Type");
  console.log("─".repeat(70));

  for (const q of settings.setting.quotaLimits) {
    const name = q.quotaUrl.padEnd(40);
    const usage = `${q.requestedNum} / ${q.quotaLimit}`.padEnd(12);
    const type = quotaTypeLabels[q.quotaType] ?? `type=${q.quotaType}`;
    const pct = q.requestedNum > 0 ? ` (${((q.requestedNum / q.quotaLimit) * 100).toFixed(1)}%)` : "";
    console.log(`${name} ${usage} ${type}${pct}`);
  }
}

main().catch(console.error);
