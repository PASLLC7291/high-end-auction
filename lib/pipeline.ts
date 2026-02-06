/**
 * Shared pipeline operations for the dropship auction lifecycle.
 *
 * Used by:
 *  - scripts/orchestrate.ts (CLI)
 *  - scripts/poll-closed-sales.ts (legacy wrapper)
 *  - app/api/cron/process/route.ts (Vercel cron)
 *  - app/api/cron/source/route.ts (Vercel cron — auto-sourcing)
 */

import { getManagementApiClient, getAccountId } from "@/lib/basta-client";
import { getCJClient } from "@/lib/cj-client";
import { processClosedItems, clearAccountFeesCache } from "@/lib/order-service";
import { getProcessedItemIds } from "@/lib/db";
import {
  insertDropshipLot,
  getDropshipLotByBastaItem,
  getDropshipLotsByStatus,
  getAllDropshipLots,
  updateDropshipLot,
  type DropshipLot,
  type DropshipLotStatus,
} from "@/lib/dropship";
import { fulfillAllPaidLots } from "@/lib/dropship-fulfillment";
import { refundAllFailedLots, type BatchRefundSummary } from "@/lib/dropship-refund";
import { sendAlert } from "@/lib/alerts";

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

export type FinancialSummary = {
  totalRevenue: number;      // sum of winning_bid_cents for lots that got paid
  totalCost: number;         // sum of total_cost_cents for fulfilled lots
  totalProfit: number;       // sum of profit_cents for lots with profit calculated
  profitMargin: number;      // percentage
  refundCount: number;       // lots in CANCELLED status
  refundAmount: number;      // sum of winning_bid_cents for refunded lots
  lotsSold: number;          // lots that reached PAID or beyond
  lotsDelivered: number;     // lots in DELIVERED status
};

export type DashboardData = {
  total: number;
  byStatus: Record<string, number>;
  stuck: DropshipLot[];
  failed: DropshipLot[];
  lots: DropshipLot[];
  financials: FinancialSummary;
};

export type QuotaInfo = {
  endpoint: string;
  used: number;
  total: number;
  remaining: number;
};

export type QuotaReport = {
  quotas: QuotaInfo[];
  criticallyLow: QuotaInfo[];  // less than 100 remaining
  healthy: boolean;
};

export type StuckLotResult = {
  auctionClosedRetried: number;
  paidRetried: number;
  cjOrderedChecked: number;
  alertsSent: number;
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

    const allClosedItems = items.filter(
      (item) => item.status === "ITEM_CLOSED"
    );

    // Items closed with no bids at all → RESERVE_NOT_MET
    const noBidItems = allClosedItems.filter(
      (item) => !item.leaderId || !item.currentBid
    );

    for (const item of noBidItems) {
      if (processedItemIds.has(item.id)) continue;
      totalReserveNotMet++;
      console.log(
        `[poll]   No bids: item ${item.id} (${item.title ?? "untitled"})`
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

    const closedWithWinner = allClosedItems.filter(
      (item) => item.leaderId && item.currentBid
    );

    // Handle reserve-not-met items (had bids but didn't meet reserve)
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

    // Filter to eligible items (won, reserve met, not yet processed)
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
// Stuck lot detection and recovery
// ---------------------------------------------------------------------------

const STUCK_THRESHOLD_AUCTION_CLOSED_MS = 30 * 60 * 1000;  // 30 minutes
const STUCK_THRESHOLD_PAID_MS = 30 * 60 * 1000;             // 30 minutes
const STUCK_THRESHOLD_CJ_ORDERED_MS = 2 * 60 * 60 * 1000;  // 2 hours
const STUCK_THRESHOLD_ALERT_MS = 4 * 60 * 60 * 1000;        // 4 hours

function getLotAgeMs(lot: DropshipLot): number {
  return Date.now() - new Date(lot.updated_at).getTime();
}

/**
 * Detect and recover lots that are stuck in intermediate states.
 *
 * - AUCTION_CLOSED > 30 min → re-run pollAndProcessClosedSales()
 * - PAID > 30 min → re-run retryFailedFulfillments()
 * - CJ_ORDERED > 2 hr → check CJ order status and update accordingly
 * - Any lot > 4 hr → send a critical alert for human intervention
 */
export async function handleStuckLots(): Promise<StuckLotResult> {
  console.log("[stuck] Checking for stuck lots...");

  const result: StuckLotResult = {
    auctionClosedRetried: 0,
    paidRetried: 0,
    cjOrderedChecked: 0,
    alertsSent: 0,
  };

  // ── AUCTION_CLOSED lots stuck > 30 minutes ──────────────────────────
  const auctionClosedLots = await getDropshipLotsByStatus("AUCTION_CLOSED");
  const stuckAuctionClosed = auctionClosedLots.filter(
    (lot) => getLotAgeMs(lot) > STUCK_THRESHOLD_AUCTION_CLOSED_MS
  );

  if (stuckAuctionClosed.length > 0) {
    console.log(
      `[stuck] ${stuckAuctionClosed.length} AUCTION_CLOSED lot(s) stuck >30min — re-running poll`
    );
    try {
      await pollAndProcessClosedSales();
      result.auctionClosedRetried = stuckAuctionClosed.length;
    } catch (e) {
      console.error("[stuck] pollAndProcessClosedSales failed during stuck lot recovery:", e);
    }
  }

  // ── PAID lots stuck > 30 minutes ────────────────────────────────────
  const paidLots = await getDropshipLotsByStatus("PAID");
  const stuckPaid = paidLots.filter(
    (lot) => getLotAgeMs(lot) > STUCK_THRESHOLD_PAID_MS
  );

  if (stuckPaid.length > 0) {
    console.log(
      `[stuck] ${stuckPaid.length} PAID lot(s) stuck >30min — retrying fulfillment`
    );
    try {
      await retryFailedFulfillments();
      result.paidRetried = stuckPaid.length;
    } catch (e) {
      console.error("[stuck] retryFailedFulfillments failed during stuck lot recovery:", e);
    }
  }

  // ── CJ_ORDERED lots stuck > 2 hours ────────────────────────────────
  const cjOrderedLots = await getDropshipLotsByStatus("CJ_ORDERED");
  const stuckCjOrdered = cjOrderedLots.filter(
    (lot) => getLotAgeMs(lot) > STUCK_THRESHOLD_CJ_ORDERED_MS
  );

  if (stuckCjOrdered.length > 0) {
    console.log(
      `[stuck] ${stuckCjOrdered.length} CJ_ORDERED lot(s) stuck >2hr — checking CJ order status`
    );
    const cj = getCJClient();

    for (const lot of stuckCjOrdered) {
      if (!lot.cj_order_id) {
        console.warn(`[stuck] Lot ${lot.id} is CJ_ORDERED but has no cj_order_id — skipping`);
        continue;
      }

      try {
        const detail = await cj.getOrderDetail(lot.cj_order_id);
        const cjStatus = detail.orderStatus?.toUpperCase() ?? "";

        console.log(
          `[stuck] Lot ${lot.id} (CJ order ${lot.cj_order_id}): CJ status="${detail.orderStatus}"`
        );

        if (cjStatus === "UNSHIPPED" || cjStatus === "PAID") {
          // CJ order is paid — update to CJ_PAID
          await updateDropshipLot(lot.id, {
            cj_order_status: detail.orderStatus,
            cj_paid_at: new Date().toISOString(),
            status: "CJ_PAID",
          });
          console.log(`[stuck] Lot ${lot.id} → CJ_PAID (CJ status: ${detail.orderStatus})`);
        } else if (cjStatus === "SHIPPED" || cjStatus === "IN_TRANSIT") {
          // CJ order is shipped — update to SHIPPED
          await updateDropshipLot(lot.id, {
            cj_order_status: detail.orderStatus,
            tracking_number: detail.trackNumber ?? null,
            tracking_carrier: detail.logisticName ?? null,
            status: "SHIPPED",
          });
          console.log(`[stuck] Lot ${lot.id} → SHIPPED (CJ status: ${detail.orderStatus})`);
        } else if (
          cjStatus === "CANCELLED" ||
          cjStatus === "FAILED" ||
          cjStatus === "REFUNDED"
        ) {
          // CJ order failed — mark as CANCELLED
          await updateDropshipLot(lot.id, {
            cj_order_status: detail.orderStatus,
            status: "CANCELLED",
            error_message: `CJ order ${lot.cj_order_id} status: ${detail.orderStatus}`,
          });
          console.log(`[stuck] Lot ${lot.id} → CANCELLED (CJ status: ${detail.orderStatus})`);
        }
        // For any other status, leave the lot as-is; the 4-hour alert below will catch it.

        result.cjOrderedChecked++;
      } catch (e) {
        console.error(
          `[stuck] Failed to check CJ order ${lot.cj_order_id} for lot ${lot.id}:`,
          e
        );
      }
    }
  }

  // ── Critical alert for any lot stuck > 4 hours ─────────────────────
  const allStuckLots = [
    ...auctionClosedLots,
    ...paidLots,
    ...cjOrderedLots,
  ];

  for (const lot of allStuckLots) {
    if (getLotAgeMs(lot) > STUCK_THRESHOLD_ALERT_MS) {
      const ageHours = (getLotAgeMs(lot) / (60 * 60 * 1000)).toFixed(1);
      await sendAlert(
        `STUCK LOT needs human intervention: lot=${lot.id} status=${lot.status} ` +
          `product="${lot.cj_product_name}" stuck for ${ageHours}h`,
        "critical"
      );
      result.alertsSent++;
    }
  }

  console.log(
    `[stuck] Done — auctionClosedRetried=${result.auctionClosedRetried} ` +
      `paidRetried=${result.paidRetried} cjOrderedChecked=${result.cjOrderedChecked} ` +
      `alertsSent=${result.alertsSent}`
  );

  return result;
}

// ---------------------------------------------------------------------------
// CJ API Quota Monitoring
// ---------------------------------------------------------------------------

/**
 * Critical CJ endpoints we track quota for.
 * The free tier has 1,000 lifetime calls per endpoint.
 */
const CRITICAL_CJ_ENDPOINTS = [
  "/product/query",
  "/product/stock/queryByVid",
  "/logistic/freightCalculate",
  "/shopping/order/createOrderV2",
  "/shopping/pay/payBalance",
];

/** Threshold below which an endpoint is considered critically low. */
const QUOTA_CRITICAL_THRESHOLD = 100;

/**
 * Check CJ API quota usage by calling getSettings() and parsing the
 * quota data from the response.
 *
 * The CJ /setting/get endpoint returns account settings which may include
 * an `apiCallLimits` or similar structure. Since the exact shape is not
 * strongly typed, we parse defensively and fall back to "unknown" if the
 * quota structure is not what we expect.
 */
export async function checkCjQuota(): Promise<QuotaReport> {
  const cj = getCJClient();
  const settings = await cj.getSettings();

  const quotas: QuotaInfo[] = [];

  // The CJ settings response may contain quota info in various shapes.
  // We try multiple known patterns defensively.

  // Pattern 1: settings.apiCallLimits as an array of { endpoint, used, total }
  // Pattern 2: settings.requestLimit / settings.requestCount style flat fields
  // Pattern 3: Nested under a "quota" or "limit" key
  const limitsSource =
    (settings.apiCallLimits as Array<Record<string, unknown>>) ??
    (settings.quotaList as Array<Record<string, unknown>>) ??
    (settings.apiLimits as Array<Record<string, unknown>>) ??
    null;

  if (Array.isArray(limitsSource)) {
    // Structured array of per-endpoint quotas
    for (const entry of limitsSource) {
      const endpoint = String(entry.endpoint ?? entry.apiPath ?? entry.path ?? "");
      const total = Number(entry.total ?? entry.limit ?? entry.maxCount ?? 1000);
      const used = Number(entry.used ?? entry.usedCount ?? entry.count ?? 0);
      const remaining = total - used;

      quotas.push({ endpoint, used, total, remaining });
    }
  } else {
    // No structured quota data — build a report from known endpoints
    // with "unknown" usage. This lets the caller know we tried but
    // could not get real data.
    //
    // Check if there are any flat numeric fields that hint at quota
    const totalLimit = Number(settings.requestLimit ?? settings.apiLimit ?? 0);
    const totalUsed = Number(settings.requestCount ?? settings.apiUsed ?? 0);

    if (totalLimit > 0) {
      // Single global quota reported
      quotas.push({
        endpoint: "(global)",
        used: totalUsed,
        total: totalLimit,
        remaining: totalLimit - totalUsed,
      });
    } else {
      // No quota data available at all — report critical endpoints
      // as having unknown usage so the caller is aware.
      for (const ep of CRITICAL_CJ_ENDPOINTS) {
        quotas.push({
          endpoint: ep,
          used: -1,   // -1 = unknown
          total: 1000, // free tier default
          remaining: -1,
        });
      }
      console.warn(
        "[quota] CJ getSettings() did not return recognizable quota data. " +
          "Reporting endpoints with unknown usage."
      );
    }
  }

  // Filter to only critical endpoints if we have per-endpoint data
  const tracked =
    quotas.length > 0 && quotas[0].endpoint !== "(global)" && quotas[0].used !== -1
      ? quotas.filter(
          (q) =>
            CRITICAL_CJ_ENDPOINTS.some((ep) => q.endpoint.includes(ep)) ||
            q.endpoint === "(global)"
        )
      : quotas;

  // Use all quotas if filtering removed everything (e.g., endpoint names differ)
  const finalQuotas = tracked.length > 0 ? tracked : quotas;

  const criticallyLow = finalQuotas.filter(
    (q) => q.remaining >= 0 && q.remaining < QUOTA_CRITICAL_THRESHOLD
  );

  return {
    quotas: finalQuotas,
    criticallyLow,
    healthy: criticallyLow.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Financial summary
// ---------------------------------------------------------------------------

/** Statuses that mean the buyer paid (PAID and everything after it in the success path). */
const PAID_OR_BEYOND: DropshipLotStatus[] = [
  "PAID",
  "CJ_ORDERED",
  "CJ_PAID",
  "SHIPPED",
  "DELIVERED",
];

/**
 * Compute a financial summary across all dropship lots.
 */
export async function getFinancialSummary(): Promise<FinancialSummary> {
  const lots = await getAllDropshipLots();

  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let refundCount = 0;
  let refundAmount = 0;
  let lotsSold = 0;
  let lotsDelivered = 0;

  for (const lot of lots) {
    // Revenue: winning_bid_cents for lots that reached PAID or beyond
    if (PAID_OR_BEYOND.includes(lot.status as DropshipLotStatus)) {
      lotsSold++;
      totalRevenue += lot.winning_bid_cents ?? 0;
    }

    // Cost: total_cost_cents for fulfilled lots (those with a recorded total cost)
    if (lot.total_cost_cents != null) {
      totalCost += lot.total_cost_cents;
    }

    // Profit: sum profit_cents where it has been calculated
    if (lot.profit_cents != null) {
      totalProfit += lot.profit_cents;
    }

    // Refunds: lots in CANCELLED status
    if (lot.status === "CANCELLED") {
      refundCount++;
      refundAmount += lot.winning_bid_cents ?? 0;
    }

    // Delivered count
    if (lot.status === "DELIVERED") {
      lotsDelivered++;
    }
  }

  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return {
    totalRevenue,
    totalCost,
    totalProfit,
    profitMargin,
    refundCount,
    refundAmount,
    lotsSold,
    lotsDelivered,
  };
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

  const financials = await getFinancialSummary();

  return {
    total: lots.length,
    byStatus,
    stuck,
    failed,
    lots,
    financials,
  };
}

// ---------------------------------------------------------------------------
// Auto-sourcing (called by cron endpoint)
// ---------------------------------------------------------------------------

export type AutoSourceResult = {
  keyword: string;
  saleId: string | null;
  lotsCreated: number;
  error?: string;
};

const AUTO_SOURCE_CJ_DELAY_MS = 1200;
const autoSourceSleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a single sourcing cycle: search CJ for the given keyword, create a
 * Basta auction sale with matching items, and publish it.
 *
 * This is the server-side equivalent of `commandSource()` in orchestrate.ts,
 * designed to be called from a Vercel cron endpoint.
 */
export async function runAutoSource(params: {
  keyword: string;
  maxCostUsd: number;
  maxProducts: number;
  publish?: boolean;
}): Promise<AutoSourceResult> {
  const { keyword, maxCostUsd, maxProducts, publish = true } = params;

  console.log(`[auto-source] Starting for keyword="${keyword}" maxCost=$${maxCostUsd} maxProducts=${maxProducts}`);

  const cj = getCJClient();
  const bastaClient = getManagementApiClient();
  const accountId = getAccountId();

  // Step 1: Search CJ
  const searchResult = await cj.searchProducts({
    keyWord: keyword,
    size: maxProducts * 2,
    countryCode: "US",
    orderBy: 1,
  });

  console.log(`[auto-source] CJ search: ${searchResult.totalRecords} total, ${searchResult.products.length} fetched`);

  if (!searchResult.products.length) {
    console.log("[auto-source] No products found.");
    return { keyword, saleId: null, lotsCreated: 0 };
  }

  // Step 2: Filter and validate candidates
  type Candidate = {
    pid: string;
    vid: string;
    productName: string;
    variantName: string;
    costCents: number;
    shippingCents: number;
    logisticName: string;
    fromCountry: string;
    images: string[];
    description: string;
    startingBidCents: number;
    reserveCents: number;
    totalCostCents: number;
  };

  const candidates: Candidate[] = [];
  const seenVids = new Set<string>();

  for (const product of searchResult.products) {
    if (candidates.length >= maxProducts) break;

    const priceStr = product.sellPrice.split(/\s*--\s*/)[0];
    const costUsd = parseFloat(priceStr);
    if (isNaN(costUsd) || costUsd > maxCostUsd) continue;
    if (product.warehouseInventoryNum < 1) continue;

    await autoSourceSleep(AUTO_SOURCE_CJ_DELAY_MS);
    let fullProduct;
    try {
      fullProduct = await cj.getProduct({ pid: product.id });
    } catch {
      continue;
    }

    const variant = fullProduct.variants?.[0];
    if (!variant) continue;
    if (seenVids.has(variant.vid)) continue;
    seenVids.add(variant.vid);

    await autoSourceSleep(AUTO_SOURCE_CJ_DELAY_MS);
    let inventory;
    try {
      inventory = await cj.getInventoryByVariant(variant.vid);
    } catch {
      continue;
    }

    const totalStock = inventory.reduce((sum, inv) => sum + inv.totalInventoryNum, 0);
    if (totalStock < 1) continue;

    const fromCountry = inventory.find((i) => i.totalInventoryNum > 0)?.countryCode ?? "CN";

    await autoSourceSleep(AUTO_SOURCE_CJ_DELAY_MS);
    let freightOptions;
    try {
      freightOptions = await cj.calculateFreight({
        startCountryCode: fromCountry,
        endCountryCode: "US",
        products: [{ vid: variant.vid, quantity: 1 }],
      });
    } catch {
      continue;
    }

    if (!freightOptions.length) continue;

    const cheapest = freightOptions.sort((a, b) => a.logisticPrice - b.logisticPrice)[0];

    const costCents = Math.round(variant.variantSellPrice * 100);
    const shippingCents = Math.round(cheapest.logisticPrice * 100);
    const totalCostCents = costCents + shippingCents;
    const startingBidCents = Math.round(totalCostCents * 0.5);
    const reserveCents = Math.round(totalCostCents * 1.3);

    const images = fullProduct.productImageSet?.length
      ? fullProduct.productImageSet
      : [product.bigImage].filter(Boolean);

    candidates.push({
      pid: fullProduct.pid,
      vid: variant.vid,
      productName: fullProduct.productNameEn || product.nameEn,
      variantName: variant.variantNameEn || "",
      costCents,
      shippingCents,
      logisticName: cheapest.logisticName,
      fromCountry,
      images,
      description: fullProduct.description || product.nameEn,
      startingBidCents,
      reserveCents,
      totalCostCents,
    });

    console.log(`[auto-source] Candidate: ${product.nameEn} — $${(totalCostCents / 100).toFixed(2)}`);
  }

  if (!candidates.length) {
    console.log("[auto-source] No viable products after filtering.");
    return { keyword, saleId: null, lotsCreated: 0 };
  }

  console.log(`[auto-source] ${candidates.length} candidate(s) ready`);

  // Step 3: Save to DB
  const lotIds: string[] = [];
  for (const c of candidates) {
    const lotId = await insertDropshipLot({
      cj_pid: c.pid,
      cj_vid: c.vid,
      cj_product_name: c.productName,
      cj_variant_name: c.variantName,
      cj_cost_cents: c.costCents,
      cj_shipping_cents: c.shippingCents,
      cj_logistic_name: c.logisticName,
      cj_from_country: c.fromCountry,
      cj_images: c.images,
      starting_bid_cents: c.startingBidCents,
      reserve_cents: c.reserveCents,
    });
    lotIds.push(lotId);
  }

  // Step 4: Create Basta sale
  const saleResult = await bastaClient.mutation({
    createSale: {
      __args: {
        accountId,
        input: {
          title: `Dropship Auction — ${keyword}`,
          description: `Auto-sourced: ${keyword}`,
          currency: "USD",
          closingMethod: "OVERLAPPING",
          closingTimeCountdown: 120000,
          bidIncrementTable: {
            rules: [
              { lowRange: 0, highRange: 1000, step: 100 },
              { lowRange: 1000, highRange: 5000, step: 250 },
              { lowRange: 5000, highRange: 10000, step: 500 },
              { lowRange: 10000, highRange: 50000, step: 1000 },
            ],
          },
        },
      },
      id: true,
      title: true,
      status: true,
    },
  });

  const saleId = saleResult.createSale?.id as string;
  if (!saleId) throw new Error("[auto-source] No sale ID returned from Basta");

  console.log(`[auto-source] Created Basta sale: ${saleId}`);

  // Attach shipping address policy
  try {
    const apiKey = process.env.API_KEY?.trim() ?? "";
    const gqlUrl = "https://management.api.basta.app/graphql";
    const gqlHeaders = {
      "Content-Type": "application/json",
      "x-account-id": accountId,
      "x-api-key": apiKey,
    };

    const policyRes = await fetch(gqlUrl, {
      method: "POST",
      headers: gqlHeaders,
      body: JSON.stringify({
        query: `mutation ($accountId: String!, $input: CreateSaleRegistrationPolicyInput!) {
          createSaleRegistrationPolicy(accountId: $accountId, input: $input) { id code }
        }`,
        variables: {
          accountId,
          input: {
            code: "require_shipping_address",
            description: "Bidders must provide a shipping address before bidding",
            rule: 'size(user.addresses.filter(a, a.addressType == "SHIPPING")) > 0',
          },
        },
      }),
    });

    const policyData = (await policyRes.json()) as {
      data?: { createSaleRegistrationPolicy?: { id: string; code: string } };
    };
    const policyId = policyData.data?.createSaleRegistrationPolicy?.id;

    if (policyId) {
      await fetch(gqlUrl, {
        method: "POST",
        headers: gqlHeaders,
        body: JSON.stringify({
          query: `mutation ($accountId: String!, $input: AttachSaleRegistrationPoliciesInput!) {
            attachSaleRegistrationPolicies(accountId: $accountId, input: $input) { id }
          }`,
          variables: {
            accountId,
            input: { saleId, policyIds: [policyId] },
          },
        }),
      });
      console.log(`[auto-source] Attached shipping address policy: ${policyId}`);
    }
  } catch (e) {
    console.warn("[auto-source] Failed to attach registration policy (non-blocking):", e);
  }

  // Step 5: Create items in the sale
  const openDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const closingDate = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();
  let itemsCreated = 0;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const lotId = lotIds[i];

    try {
      const itemResult = await bastaClient.mutation({
        createItemForSale: {
          __args: {
            accountId,
            input: {
              saleId,
              title: c.productName,
              description: c.description,
              startingBid: c.startingBidCents,
              reserve: c.reserveCents,
              openDate,
              closingDate,
              allowedBidTypes: ["MAX", "NORMAL"],
              ItemNumber: i + 1,
            },
          },
          id: true,
          title: true,
        },
      });

      const itemId = itemResult.createItemForSale?.id as string;
      if (!itemId) throw new Error("No item ID returned");

      // Upload images
      for (let j = 0; j < c.images.length; j++) {
        try {
          const uploadResult = await bastaClient.mutation({
            createUploadUrl: {
              __args: {
                accountId,
                input: {
                  imageTypes: ["SALE_ITEM"],
                  contentType: "image/jpeg",
                  order: j + 1,
                  saleId,
                  itemId,
                },
              },
              imageId: true,
              uploadUrl: true,
              imageUrl: true,
              headers: { key: true, value: true },
            },
          });

          const uploadData = uploadResult.createUploadUrl;
          if (!uploadData?.uploadUrl) continue;

          const imgResponse = await fetch(c.images[j]);
          if (!imgResponse.ok) continue;
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

          const putHeaders: Record<string, string> = { "Content-Type": "image/jpeg" };
          for (const h of uploadData.headers ?? []) {
            if (h.key !== "Host") putHeaders[h.key] = h.value;
          }

          await fetch(uploadData.uploadUrl, {
            method: "PUT",
            headers: putHeaders,
            body: imgBuffer,
          });
        } catch {
          // Image upload failure is non-blocking
        }
      }

      await updateDropshipLot(lotId, {
        basta_sale_id: saleId,
        basta_item_id: itemId,
        status: "LISTED",
      });

      itemsCreated++;
      console.log(`[auto-source] Item ${i + 1}/${candidates.length}: ${c.productName} -> ${itemId}`);
    } catch (error) {
      console.error(`[auto-source] Failed to create item: ${c.productName}`, error);
      await updateDropshipLot(lotId, {
        status: "CANCELLED",
        error_message: String(error),
      });
    }
  }

  // Step 6: Publish
  if (publish && itemsCreated > 0) {
    await bastaClient.mutation({
      publishSale: {
        __args: { accountId, input: { saleId } },
        id: true,
        status: true,
      },
    });

    for (const lotId of lotIds) {
      await updateDropshipLot(lotId, { status: "PUBLISHED" });
    }
    console.log("[auto-source] Sale published!");
  }

  console.log(`[auto-source] Complete: sale=${saleId}, lots=${itemsCreated}`);
  return { keyword, saleId, lotsCreated: itemsCreated };
}
