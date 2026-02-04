import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { db, generateId } from "../lib/turso";

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
            "  tsx scripts/create-balance-promo.ts --code <CODE> --amount <dollars> [--starts <ISO>] [--ends <ISO>] [--max <int>] [--description \"...\"] [--inactive]",
            "",
            "Examples:",
            "  tsx scripts/create-balance-promo.ts --code WELCOME5 --amount 5 --description \"Welcome\"",
            "  tsx scripts/create-balance-promo.ts --code FEB5 --amount 5 --starts 2026-02-01T00:00:00Z --ends 2026-02-29T23:59:59Z",
        ].join("\n")
    );
    process.exit(1);
}

function parseAmountToCents(input: string): number {
    const trimmed = input.trim();
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
    if (!match) {
        throw new Error('Invalid --amount. Use a number like "5" or "10.50".');
    }
    const dollars = Number(match[1]);
    const centsPart = (match[2] ?? "0").padEnd(2, "0");
    const cents = Number(centsPart);
    return dollars * 100 + cents;
}

async function main() {
    const codeRaw = getArg("--code");
    const amountRaw = getArg("--amount");
    const startsAt = getArg("--starts");
    const endsAt = getArg("--ends");
    const maxRaw = getArg("--max");
    const description = getArg("--description");
    const inactive = hasFlag("--inactive");

    if (!codeRaw || !amountRaw) {
        usage();
    }

    const code = codeRaw.trim();
    if (!code) {
        throw new Error("Code is required");
    }

    const amountCents = parseAmountToCents(amountRaw);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
        throw new Error("--amount must be greater than 0");
    }

    const max = maxRaw ? Number.parseInt(maxRaw, 10) : null;
    if (maxRaw && (!Number.isInteger(max) || max < 1)) {
        throw new Error("--max must be a positive integer");
    }

    const id = generateId();
    await db.execute({
        sql: `
            INSERT INTO balance_promotions (
                id, code, amount_cents, currency, description,
                starts_at, ends_at, max_redemptions, active, created_at
            ) VALUES (?, ?, ?, 'USD', ?, ?, ?, ?, ?, datetime('now'))
        `,
        args: [
            id,
            code,
            amountCents,
            description ?? null,
            startsAt ?? null,
            endsAt ?? null,
            max ?? null,
            inactive ? 0 : 1,
        ],
    });

    console.log("Balance promo created:");
    console.log(`- id: ${id}`);
    console.log(`- code: ${code}`);
    console.log(`- amount: ${(amountCents / 100).toFixed(2)} USD`);
    if (startsAt) console.log(`- starts: ${startsAt}`);
    if (endsAt) console.log(`- ends: ${endsAt}`);
    if (max) console.log(`- max: ${max}`);
    if (description) console.log(`- description: ${description}`);
    console.log(`- active: ${inactive ? "no" : "yes"}`);
}

main().catch((error) => {
    console.error("Failed to create promo:", error);
    process.exit(1);
});

