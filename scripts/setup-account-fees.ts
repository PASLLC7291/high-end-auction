import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { getAccountId, getManagementApiClient } from "../lib/basta-client";

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
            '  tsx scripts/setup-account-fees.ts --name "Buyer\'s Premium" --type PERCENTAGE --value 1500 --lowerLimit 0',
            "",
            "Options:",
            "  --name         Fee name (required)",
            "  --type         PERCENTAGE or AMOUNT (required)",
            "  --value        Fee value: basis points for PERCENTAGE (1500 = 15%), minor currency units for AMOUNT (required)",
            "  --lowerLimit   Minimum item amount for fee to apply, in minor units (default: 0)",
            "  --upperLimit   Maximum item amount for fee to apply, in minor units (optional)",
            "  --list         List existing account fees and exit",
            "  --delete <id>  Delete a fee by ID",
            "",
            "Examples:",
            '  tsx scripts/setup-account-fees.ts --name "Buyer\'s Premium" --type PERCENTAGE --value 1500 --lowerLimit 0',
            '  tsx scripts/setup-account-fees.ts --name "Flat Fee" --type AMOUNT --value 500',
            "  tsx scripts/setup-account-fees.ts --list",
            "  tsx scripts/setup-account-fees.ts --delete fee-id-here",
            "",
            "Requires .env.local with ACCOUNT_ID + API_KEY.",
        ].join("\n")
    );
    process.exit(1);
}

async function listFees() {
    const client = getManagementApiClient();
    const accountId = getAccountId();

    const res = await client.query({
        account: {
            __args: { accountId },
            paymentDetails: {
                accountFees: {
                    id: true,
                    name: true,
                    type: true,
                    value: true,
                    lowerLimit: true,
                    upperLteLimit: true,
                },
            },
        },
    });

    const fees = (res.account?.paymentDetails?.accountFees as Array<Record<string, unknown>>) ?? [];

    if (fees.length === 0) {
        console.log("No account fees configured.");
        return;
    }

    console.log(`Found ${fees.length} account fee(s):\n`);
    for (const fee of fees) {
        const typeStr = fee.type === "PERCENTAGE"
            ? `${(fee.value as number) / 100}%`
            : `${fee.value} (fixed)`;
        console.log(`  ID:    ${fee.id}`);
        console.log(`  Name:  ${fee.name}`);
        console.log(`  Type:  ${fee.type} (${typeStr})`);
        console.log(`  Range: ${fee.lowerLimit} - ${fee.upperLteLimit ?? "no limit"}`);
        console.log();
    }
}

async function deleteFee(feeId: string) {
    const client = getManagementApiClient();
    const accountId = getAccountId();

    await client.mutation({
        deleteAccountFee: {
            __args: { accountId, input: { id: feeId } },
        },
    });

    console.log(`Deleted account fee: ${feeId}`);
}

async function createFee() {
    const name = getArg("--name");
    const type = getArg("--type")?.toUpperCase();
    const valueStr = getArg("--value");
    const lowerLimitStr = getArg("--lowerLimit") ?? "0";
    const upperLimitStr = getArg("--upperLimit");

    if (!name || !type || !valueStr) usage();
    if (type !== "PERCENTAGE" && type !== "AMOUNT") {
        console.error("--type must be PERCENTAGE or AMOUNT");
        process.exit(1);
    }

    const value = parseInt(valueStr!, 10);
    const lowerLimit = parseInt(lowerLimitStr, 10);
    const upperLteLimit = upperLimitStr ? parseInt(upperLimitStr, 10) : null;

    if (isNaN(value) || isNaN(lowerLimit)) {
        console.error("--value and --lowerLimit must be integers");
        process.exit(1);
    }

    const client = getManagementApiClient();
    const accountId = getAccountId();

    const res = await client.mutation({
        createAccountFee: {
            __args: {
                accountId,
                input: {
                    name: name!,
                    type: type as "PERCENTAGE" | "AMOUNT",
                    value,
                    lowerLimit,
                    ...(upperLteLimit != null ? { upperLteLimit } : {}),
                },
            },
            id: true,
            name: true,
            type: true,
            value: true,
            lowerLimit: true,
            upperLteLimit: true,
        },
    });

    const fee = res.createAccountFee;
    console.log("Created account fee:");
    console.log(`  ID:    ${fee?.id}`);
    console.log(`  Name:  ${fee?.name}`);
    console.log(`  Type:  ${fee?.type}`);
    console.log(`  Value: ${fee?.value}`);
}

async function main() {
    if (hasFlag("--list")) {
        await listFees();
        return;
    }

    const deleteId = getArg("--delete");
    if (deleteId) {
        await deleteFee(deleteId);
        return;
    }

    if (!getArg("--name") && !getArg("--type") && !getArg("--value")) {
        usage();
    }

    await createFee();
}

main().catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
});
