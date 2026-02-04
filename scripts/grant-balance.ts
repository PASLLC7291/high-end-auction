import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { getUserByEmail } from "../lib/user";
import { grantUserBalance } from "../lib/balance";

function getArg(name: string): string | null {
    const idx = process.argv.findIndex((a) => a === name);
    if (idx === -1) return null;
    return process.argv[idx + 1] ?? null;
}

function usage(): never {
    console.error(
        [
            "Usage:",
            "  tsx scripts/grant-balance.ts --email <user@example.com> --amount <dollars> [--currency USD] [--description \"...\"]",
            "",
            "Examples:",
            "  tsx scripts/grant-balance.ts --email user@example.com --amount 25",
            "  tsx scripts/grant-balance.ts --email user@example.com --amount 10.50 --description \"Refund\"",
            "",
            "Notes:",
            "  - Amount is in major units (e.g., dollars).",
            "  - This creates a Stripe Customer Balance Transaction (negative amount) so it applies automatically to invoices.",
        ].join("\n")
    );
    process.exit(1);
}

function parseAmountToCents(input: string): number {
    const trimmed = input.trim();
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
    if (!match) {
        throw new Error('Invalid --amount. Use a number like "25" or "10.50".');
    }
    const dollars = Number(match[1]);
    const centsPart = (match[2] ?? "0").padEnd(2, "0");
    const cents = Number(centsPart);
    return dollars * 100 + cents;
}

async function main() {
    const email = getArg("--email");
    const amount = getArg("--amount");
    const currency = getArg("--currency") || "USD";
    const description = getArg("--description") || "Balance adjustment";

    if (!email || !amount) {
        usage();
    }

    const user = await getUserByEmail(email);
    if (!user) {
        throw new Error(`No user found for email: ${email}`);
    }

    const amountCents = parseAmountToCents(amount);

    const result = await grantUserBalance({
        userId: user.id,
        email: user.email,
        name: user.name,
        amountCents,
        currency,
        description,
        metadata: { userId: user.id, source: "manual" },
    });

    console.log("Balance granted:");
    console.log(`- userId: ${user.id}`);
    console.log(`- email: ${user.email}`);
    console.log(`- customerId: ${result.customerId}`);
    console.log(`- transactionId: ${result.transactionId}`);
    console.log(`- amount: ${(amountCents / 100).toFixed(2)} ${result.currency}`);
}

main().catch((error) => {
    console.error("Failed to grant balance:", error);
    process.exit(1);
});

