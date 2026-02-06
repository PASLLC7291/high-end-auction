/**
 * Shared pipeline operations for the dropship auction lifecycle.
 *
 * Used by:
 *  - scripts/orchestrate.ts (CLI)
 *  - scripts/poll-closed-sales.ts (legacy wrapper)
 *  - app/api/cron/process/route.ts (Vercel cron)
 */

import { getManagementApiClient, getAccountId } from "@/lib/basta-client";
import { processClosedItems, clearAccountFeesCache } from "@/lib/order-service";
import { getProcessedItemIds } from "@/lib/db";
import {
  getDropshipLotByBastaItem,
  getDropshipLotsByStatus,
  getAllDropshipLots,
  updateDropshipLot,
  type DropshipLot,
  type DropshipLotStatus,
} from "@/lib/dropship";
import { fulfillAllPaidLots } from "@/lib/dropship-fulfillment";
import { refundAllFailedLots, type BatchRefundSummary } from "@/lib/dropship-refund";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SaleNode = {
  id: string;
  status: string;
  title?: string | null;
};

export type SaleItemNode = {
  id: string;
  status: string;
  leaderId?: string | null;
  currentBid?: number | null;
  title?: string | null;
  reserveMet?: boolean | null;
};

export type PollResult = {
  salesChecked: number;
  alreadyProcessed: number;
  reserveNotMet: number;
  newlyProcessed: number;
};

export type DashboardData = {
  total: number;
  byStatus: Record<string, number>;
  stuck: DropshipLot[];
  failed: DropshipLot[];
  lots: DropshipLot[];
};

// ---------------------------------------------------------------------------
// Basta queries (extracted from poll-closed-sales.ts)
// ---------------------------------------------------------------------------

type SalesQueryResponse = {
  sales?: {
    edges?: Array<{ node?: SaleNode | null } | null> | null;
    pageInfo?: { hasNextPage: boolean; endCursor?: string | null } | null;
  } | null;
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

/**
 * Fetch all CLOSED sales from Basta, paginating through the full list.
 */
export async function fetchClosedSales(): Promise<SaleNode[]> {
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
export async function fetchSaleItems(
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

/**
 * Query status of a single sale from Basta.
 */
export async function getSaleStatus(
  saleId: string
): Promise<{ id: string; status: string; currency: string; items: SaleItemNode[] }> {
  const { items, currency } = await fetchSaleItems(saleId);

  const client = getManagementApiClient();
  const accountId = getAccountId();

  const response = (await client.query({
    sale: {
      __args: { accountId, id: saleId },
      id: true,
      status: true,
    },
  })) as unknown as { sale?: { id?: string; status?: string } };

  return {
    id: saleId,
    status: (response.sale?.status as string) ?? "UNKNOWN",
    currency,
    items,
  };
}

// ---------------------------------------------------------------------------
// Core pipeline operations
// ---------------------------------------------------------------------------

/**
 * Poll Basta for closed sales and process unhandled auction items.
 * Extracted from scripts/poll-closed-sales.ts main().
 */
export async function pollAndProcessClosedSales(options?: {
  dryRun?: boolean;
}): Promise<PollResult> {
  const dryRun = options?.dryRun ?? false;

  console.log("[poll] Starting poll for closed sales...");
  if (dryRun) console.log("[poll] DRY RUN mode — no processing will occur.");

  const closedSales = await fetchClosedSales();
  console.log(`[poll] Found ${closedSales.length} CLOSED sale(s) in Basta.`);

  if (closedSales.length === 0) {
    console.log("[poll] Nothing to do.");
    return { salesChecked: 0, alreadyProcessed: 0, reserveNotMet: 0, newlyProcessed: 0 };
  }

  const processedItemIds = await getProcessedItemIds();
  console.log(`[poll] ${processedItemIds.size} item(s) already processed in local DB.`);

  let totalUnprocessed = 0;
  let totalReserveNotMet = 0;
  let totalSkipped = 0;

  for (const sale of closedSales) {
    console.log(
      `\n[poll] Checking sale ${sale.id}${sale.title ? ` ("${sale.title}")` : ""}...`
    );

    const { items, currency } = await fetchSaleItems(sale.id);
    console.log(`[poll]   ${items.length} total item(s) in sale.`);

    const closedWithWinner = items.filter(
      (item) =>
        item.status === "ITEM_CLOSED" && item.leaderId && item.currentBid
    );

    // Handle reserve-not-met items
    const reserveNotMetItems = closedWithWinner.filter(
      (item) => item.reserveMet === false
    );

    for (const item of reserveNotMetItems) {
      if (processedItemIds.has(item.id)) continue;
      totalReserveNotMet++;
      console.log(
        `[poll]   Reserve not met: item ${item.id} (${item.title ?? "untitled"}) — bid: ${item.currentBid}`
      );

      if (!dryRun) {
        try {
          const lot = await getDropshipLotByBastaItem(item.id);
          if (lot && lot.status !== "RESERVE_NOT_MET") {
            await updateDropshipLot(lot.id, { status: "RESERVE_NOT_MET" });
            console.log(`[poll]     Updated dropship lot ${lot.id} → RESERVE_NOT_MET`);
          }
        } catch (e) {
          console.warn(`[poll]     Failed to update dropship lot for item ${item.id}:`, e);
        }
      }
    }

    // Filter to eligible items
    const eligibleItems = closedWithWinner.filter(
      (item) => item.reserveMet !== false && !processedItemIds.has(item.id)
    );

    const alreadyProcessed =
      closedWithWinner.length - reserveNotMetItems.length - eligibleItems.length;
    totalSkipped += alreadyProcessed;

    if (alreadyProcessed > 0) {
      console.log(`[poll]   ${alreadyProcessed} item(s) already processed — skipping.`);
    }

    if (eligibleItems.length === 0) {
      console.log(`[poll]   No unprocessed items in this sale.`);
      continue;
    }

    totalUnprocessed += eligibleItems.length;
    console.log(`[poll]   ${eligibleItems.length} unprocessed item(s) found:`);

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

    // Update dropship lots with winner info
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
            `[poll]     Updated dropship lot ${lot.id} → AUCTION_CLOSED (winner: ${item.leaderId})`
          );
        }
      } catch (e) {
        console.warn(`[poll]     Failed to update dropship lot for item ${item.itemId}:`, e);
      }
    }

    // Process closed items (create orders + invoices)
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

  const result: PollResult = {
    salesChecked: closedSales.length,
    alreadyProcessed: totalSkipped,
    reserveNotMet: totalReserveNotMet,
    newlyProcessed: totalUnprocessed,
  };

  console.log(`\n[poll] === Summary ===`);
  console.log(`[poll]   Sales checked:       ${result.salesChecked}`);
  console.log(`[poll]   Already processed:   ${result.alreadyProcessed}`);
  console.log(`[poll]   Reserve not met:     ${result.reserveNotMet}`);
  console.log(`[poll]   Newly processed:     ${result.newlyProcessed}`);
  console.log(`[poll] Done.`);

  return result;
}

/**
 * Retry fulfillment for all PAID lots that haven't been sent to CJ yet.
 */
export async function retryFailedFulfillments(): Promise<{ processed: number }> {
  console.log("[fulfill] Retrying failed fulfillments...");
  const paidLots = await getDropshipLotsByStatus("PAID");
  console.log(`[fulfill] Found ${paidLots.length} PAID lot(s) to retry.`);

  if (paidLots.length === 0) return { processed: 0 };

  await fulfillAllPaidLots();
  return { processed: paidLots.length };
}

/**
 * Process refunds for all CJ-failed lots (CJ_OUT_OF_STOCK, CJ_PRICE_CHANGED).
 */
export async function processRefunds(): Promise<BatchRefundSummary> {
  console.log("[refund] Processing refunds for failed lots...");
  const summary = await refundAllFailedLots();
  return summary;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Statuses considered "stuck" — they've been sitting without progress. */
const STUCK_STATUSES: DropshipLotStatus[] = ["AUCTION_CLOSED", "PAID", "CJ_ORDERED"];

/** Statuses considered terminal failures. */
const FAILED_STATUSES: DropshipLotStatus[] = [
  "CJ_OUT_OF_STOCK",
  "CJ_PRICE_CHANGED",
  "PAYMENT_FAILED",
  "CANCELLED",
];

/**
 * Build a dashboard summary of all dropship lots.
 */
export async function getStatusDashboard(): Promise<DashboardData> {
  const lots = await getAllDropshipLots();

  const byStatus: Record<string, number> = {};
  const stuck: DropshipLot[] = [];
  const failed: DropshipLot[] = [];

  for (const lot of lots) {
    byStatus[lot.status] = (byStatus[lot.status] ?? 0) + 1;

    if (STUCK_STATUSES.includes(lot.status as DropshipLotStatus)) {
      stuck.push(lot);
    }
    if (FAILED_STATUSES.includes(lot.status as DropshipLotStatus)) {
      failed.push(lot);
    }
  }

  return {
    total: lots.length,
    byStatus,
    stuck,
    failed,
    lots,
  };
}
