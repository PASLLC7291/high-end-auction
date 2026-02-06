/**
 * poll-closed-sales.ts
 *
 * Fallback cron script that catches missed Basta webhooks.
 *
 * The primary flow uses SaleStatusChanged / ItemsStatusChanged webhooks to
 * process closed auction items (create orders, issue invoices, update dropship
 * lots). If a webhook delivery fails or is lost, those items sit unprocessed.
 *
 * This script:
 *   1. Queries Basta for all CLOSED sales (paginated).
 *   2. For each closed sale, fetches its items (paginated).
 *   3. Identifies ITEM_CLOSED items with a winner (leaderId) and reserveMet.
 *   4. Filters out items already tracked in payment_order_items.
 *   5. Updates the corresponding dropship lots with winner info.
 *   6. Calls processClosedItems() for the remaining unprocessed items.
 *
 * Usage:
 *   pnpm tsx scripts/poll-closed-sales.ts
 *   pnpm tsx scripts/poll-closed-sales.ts --dry-run
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local (same pattern as other scripts)
config({ path: resolve(process.cwd(), ".env.local") });

import { getManagementApiClient, getAccountId } from "../lib/basta-client";
import { processClosedItems, clearAccountFeesCache } from "../lib/order-service";
import { getProcessedItemIds } from "../lib/db";
import { getDropshipLotByBastaItem, updateDropshipLot } from "../lib/dropship";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SaleNode = {
    id: string;
    status: string;
    title?: string | null;
};

type SalesQueryResponse = {
    sales?: {
        edges?: Array<{ node?: SaleNode | null } | null> | null;
        pageInfo?: { hasNextPage: boolean; endCursor?: string | null } | null;
    } | null;
};

type SaleItemNode = {
    id: string;
    status: string;
    leaderId?: string | null;
    currentBid?: number | null;
    title?: string | null;
    reserveMet?: boolean | null;
};

type SaleDetailQueryResponse = {
    sale?: {
        id?: string | null;
        status?: string | null;
        currency?: string | null;
        items?: {
            edges?: Array<{ node?: SaleItemNode | null } | null> | null;
            pageInfo?: { hasNextPage: boolean; endCursor?: string | null } | null;
        } | null;
    } | null;
};

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

function hasFlag(name: string): boolean {
    return process.argv.includes(name);
}

// ---------------------------------------------------------------------------
// Basta queries
// ---------------------------------------------------------------------------

/**
 * Fetch all CLOSED sales from Basta, paginating through the full list.
 */
async function fetchClosedSales(): Promise<SaleNode[]> {
    const client = getManagementApiClient();
    const accountId = getAccountId();

    const closedSales: SaleNode[] = [];
    let after: string | undefined = undefined;

    while (true) {
        const response: SalesQueryResponse = (await client.query({
            sales: {
                __args: { accountId, first: 50, after },
                edges: {
                    node: {
                        id: true,
                        status: true,
                        title: true,
                    },
                },
                pageInfo: {
                    hasNextPage: true,
                    endCursor: true,
                },
            },
        })) as unknown as SalesQueryResponse;

        const connection = response.sales;
        if (!connection?.edges?.length) break;

        for (const edge of connection.edges) {
            const node = edge?.node;
            if (node && node.status === "CLOSED") {
                closedSales.push(node);
            }
        }

        if (!connection.pageInfo?.hasNextPage) break;
        after = connection.pageInfo.endCursor ?? undefined;
    }

    return closedSales;
}

/**
 * Fetch all items for a single sale, paginating through the full list.
 */
async function fetchSaleItems(
    saleId: string
): Promise<{ currency: string; items: SaleItemNode[] }> {
    const client = getManagementApiClient();
    const accountId = getAccountId();

    const items: SaleItemNode[] = [];
    let saleCurrency: string | null = null;
    let after: string | undefined = undefined;

    while (true) {
        const response: SaleDetailQueryResponse = (await client.query({
            sale: {
                __args: { accountId, id: saleId },
                id: true,
                status: true,
                currency: true,
                items: {
                    __args: { first: 50, after },
                    edges: {
                        node: {
                            id: true,
                            status: true,
                            leaderId: true,
                            currentBid: true,
                            title: true,
                            reserveMet: true,
                        },
                    },
                    pageInfo: {
                        hasNextPage: true,
                        endCursor: true,
                    },
                },
            },
        })) as unknown as SaleDetailQueryResponse;

        if (!response.sale) break;
        saleCurrency = saleCurrency ?? (response.sale.currency as string | null);

        const connection = response.sale.items;
        if (connection?.edges?.length) {
            for (const edge of connection.edges) {
                if (edge?.node) items.push(edge.node as SaleItemNode);
            }
        }

        if (!connection?.pageInfo?.hasNextPage) break;
        after = connection.pageInfo.endCursor ?? undefined;
    }

    return { currency: saleCurrency ?? "USD", items };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const dryRun = hasFlag("--dry-run");

    console.log("[poll] Starting poll for closed sales...");
    if (dryRun) {
        console.log("[poll] DRY RUN mode -- no processing will occur.");
    }

    // Step 1: Fetch all closed sales from Basta
    const closedSales = await fetchClosedSales();
    console.log(`[poll] Found ${closedSales.length} CLOSED sale(s) in Basta.`);

    if (closedSales.length === 0) {
        console.log("[poll] Nothing to do.");
        return;
    }

    // Step 2: Load the set of already-processed item IDs from local DB
    const processedItemIds = await getProcessedItemIds();
    console.log(
        `[poll] ${processedItemIds.size} item(s) already processed in local DB.`
    );

    let totalUnprocessed = 0;
    let totalReserveNotMet = 0;
    let totalSkipped = 0;

    // Step 3: For each closed sale, fetch items and find unprocessed ones
    for (const sale of closedSales) {
        console.log(
            `\n[poll] Checking sale ${sale.id}${sale.title ? ` ("${sale.title}")` : ""}...`
        );

        const { items, currency } = await fetchSaleItems(sale.id);
        console.log(`[poll]   ${items.length} total item(s) in sale.`);

        // Identify closed items with a winner
        const closedWithWinner = items.filter(
            (item) =>
                item.status === "ITEM_CLOSED" &&
                item.leaderId &&
                item.currentBid
        );

        // Handle reserve-not-met items (mark dropship lots but don't process orders)
        const reserveNotMetItems = closedWithWinner.filter(
            (item) => item.reserveMet === false
        );

        for (const item of reserveNotMetItems) {
            if (processedItemIds.has(item.id)) continue;

            totalReserveNotMet++;
            console.log(
                `[poll]   Reserve not met: item ${item.id} (${item.title ?? "untitled"}) -- bid: ${item.currentBid}`
            );

            if (!dryRun) {
                try {
                    const lot = await getDropshipLotByBastaItem(item.id);
                    if (lot && lot.status !== "RESERVE_NOT_MET") {
                        await updateDropshipLot(lot.id, {
                            status: "RESERVE_NOT_MET",
                        });
                        console.log(
                            `[poll]     Updated dropship lot ${lot.id} -> RESERVE_NOT_MET`
                        );
                    }
                } catch (e) {
                    console.warn(
                        `[poll]     Failed to update dropship lot for item ${item.id}:`,
                        e
                    );
                }
            }
        }

        // Filter to items eligible for order processing:
        //   - ITEM_CLOSED with a leader
        //   - Reserve was met (not explicitly false)
        //   - Not already processed
        const eligibleItems = closedWithWinner.filter(
            (item) =>
                item.reserveMet !== false && !processedItemIds.has(item.id)
        );

        const alreadyProcessed =
            closedWithWinner.length -
            reserveNotMetItems.length -
            eligibleItems.length;
        totalSkipped += alreadyProcessed;

        if (alreadyProcessed > 0) {
            console.log(
                `[poll]   ${alreadyProcessed} item(s) already processed -- skipping.`
            );
        }

        if (eligibleItems.length === 0) {
            console.log(`[poll]   No unprocessed items in this sale.`);
            continue;
        }

        totalUnprocessed += eligibleItems.length;
        console.log(
            `[poll]   ${eligibleItems.length} unprocessed item(s) found:`
        );

        const closedItems = eligibleItems.map((item) => ({
            itemId: item.id,
            leaderId: item.leaderId as string,
            currentBid: item.currentBid as number,
            title: item.title || "",
        }));

        for (const item of closedItems) {
            console.log(
                `[poll]     - ${item.itemId} "${item.title}" winner=${item.leaderId} bid=${item.currentBid}`
            );
        }

        if (dryRun) {
            console.log(`[poll]   Skipping processing (dry run).`);
            continue;
        }

        // Step 4: Update dropship lots with winner info
        for (const item of closedItems) {
            try {
                const lot = await getDropshipLotByBastaItem(item.itemId);
                if (lot) {
                    await updateDropshipLot(lot.id, {
                        winner_user_id: item.leaderId,
                        winning_bid_cents: item.currentBid,
                        status: "AUCTION_CLOSED",
                    });
                    console.log(
                        `[poll]     Updated dropship lot ${lot.id} -> AUCTION_CLOSED (winner: ${item.leaderId})`
                    );
                }
            } catch (e) {
                console.warn(
                    `[poll]     Failed to update dropship lot for item ${item.itemId}:`,
                    e
                );
            }
        }

        // Step 5: Process closed items (create orders + invoices)
        clearAccountFeesCache();
        await processClosedItems({
            saleId: sale.id,
            items: closedItems,
            currency,
        });

        console.log(
            `[poll]   Finished processing ${closedItems.length} item(s) for sale ${sale.id}.`
        );
    }

    // Summary
    console.log(`\n[poll] === Summary ===`);
    console.log(`[poll]   Sales checked:       ${closedSales.length}`);
    console.log(`[poll]   Already processed:   ${totalSkipped}`);
    console.log(`[poll]   Reserve not met:     ${totalReserveNotMet}`);
    console.log(`[poll]   Newly processed:     ${totalUnprocessed}`);
    console.log(`[poll] Done.`);
}

main().catch((error) => {
    console.error("[poll] Fatal error:", error);
    process.exit(1);
});
