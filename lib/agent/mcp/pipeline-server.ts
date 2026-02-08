/**
 * Pipeline Tool Server — 17 tools wrapping lib/pipeline.ts, lib/dropship.ts,
 * lib/sourcing-keywords.ts, and lib/smart-sourcing.ts functions.
 */

import { z } from "zod";
import type { ToolDefinition, ToolResult } from "../types";
import {
  getStatusDashboard,
  getFinancialSummary,
  pollAndProcessClosedSales,
  retryFailedFulfillments,
  processRefunds,
  handleStuckLots,
  checkCjQuota,
  runAutoSource,
  fetchClosedSales,
  fetchSaleItems,
  getSaleStatus,
} from "@/lib/pipeline";
import {
  getDropshipLotById,
  getDropshipLotsByStatus,
  getDropshipLotsBySale,
  getAllDropshipLots,
  getDropshipLotStatusCounts,
  updateDropshipLot,
  type DropshipLotStatus,
} from "@/lib/dropship";
import {
  listKeywords,
  insertKeyword,
} from "@/lib/sourcing-keywords";
import { runSmartSource } from "@/lib/smart-sourcing";
import { validateTransition } from "../state-machine";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function ok(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function err(message: string): ToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Pipeline Tools
// ---------------------------------------------------------------------------

export const pipelineTools: ToolDefinition[] = [
  // ── Read-only dashboard/financial tools ──────────────────────────────
  {
    name: "pipeline_get_dashboard",
    description:
      "Get the full operational dashboard: lot counts by status, stuck lots, failed lots, and financial summary.",
    schema: z.object({}),
    handler: async () => {
      const data = await getStatusDashboard();
      // Omit full lot list to keep response size manageable
      return ok({
        total: data.total,
        byStatus: data.byStatus,
        stuckCount: data.stuck.length,
        stuckLots: data.stuck.map((l) => ({
          id: l.id,
          status: l.status,
          product: l.cj_product_name,
          updatedAt: l.updated_at,
        })),
        failedCount: data.failed.length,
        failedLots: data.failed.map((l) => ({
          id: l.id,
          status: l.status,
          product: l.cj_product_name,
          error: l.error_message,
        })),
        financials: data.financials,
      });
    },
  },
  {
    name: "pipeline_get_financials",
    description:
      "Get financial summary: revenue, cost, profit, margin, refund count/amount, lots sold, lots delivered.",
    schema: z.object({}),
    handler: async () => {
      const data = await getFinancialSummary();
      return ok(data);
    },
  },

  // ── Write tools ─────────────────────────────────────────────────────
  {
    name: "pipeline_poll_closed_sales",
    description:
      "Poll Basta for closed sales and process unhandled auction items (create orders/invoices for winners, mark reserve-not-met). Optionally run in dry-run mode.",
    schema: z.object({
      dryRun: z.boolean().optional().describe("If true, only report what would be processed without making changes."),
    }),
    handler: async (args) => {
      const result = await pollAndProcessClosedSales({
        dryRun: args.dryRun as boolean | undefined,
      });
      return ok(result);
    },
  },
  {
    name: "pipeline_retry_fulfillments",
    description:
      "Retry CJ fulfillment for all lots in PAID status that haven't been sent to CJ yet.",
    schema: z.object({}),
    handler: async () => {
      const result = await retryFailedFulfillments();
      return ok(result);
    },
  },
  {
    name: "pipeline_process_refunds",
    description:
      "Process refunds for all lots in CJ_OUT_OF_STOCK and CJ_PRICE_CHANGED status. Refunds via Stripe and cancels Basta orders.",
    schema: z.object({}),
    handler: async () => {
      const result = await processRefunds();
      return ok(result);
    },
  },
  {
    name: "pipeline_handle_stuck_lots",
    description:
      "Detect and recover lots stuck in intermediate states. AUCTION_CLOSED >30min triggers re-poll, PAID >30min triggers retry, CJ_ORDERED >2hr checks CJ status, >4hr sends critical alert.",
    schema: z.object({}),
    handler: async () => {
      const result = await handleStuckLots();
      return ok(result);
    },
  },

  // ── CJ Quota ────────────────────────────────────────────────────────
  {
    name: "pipeline_check_cj_quota",
    description:
      "Check CJ Dropshipping API quota usage. Returns per-endpoint quota info and flags any critically low endpoints (<100 remaining).",
    schema: z.object({}),
    handler: async () => {
      const result = await checkCjQuota();
      return ok(result);
    },
  },

  // ── Sourcing ────────────────────────────────────────────────────────
  {
    name: "pipeline_auto_source",
    description:
      "Run a single auto-sourcing cycle: search CJ for a keyword, create a Basta auction sale with matching items, and optionally publish it. Each product requires 3-4 CJ API calls.",
    schema: z.object({
      keyword: z.string().describe("CJ search keyword"),
      maxCostUsd: z.number().describe("Maximum wholesale cost in USD"),
      maxProducts: z.number().describe("Maximum number of products to source (max 5 recommended)"),
      publish: z.boolean().optional().describe("Publish the sale immediately after creation"),
    }),
    handler: async (args) => {
      const result = await runAutoSource({
        keyword: args.keyword as string,
        maxCostUsd: args.maxCostUsd as number,
        maxProducts: args.maxProducts as number,
        publish: args.publish as boolean | undefined,
      });
      return ok(result);
    },
  },
  {
    name: "pipeline_smart_source",
    description:
      "Run smart sourcing: 3-phase pipeline that searches broadly, scores products, and creates multiple auctions. WARNING: Uses ~1,600 CJ API calls. Check quota first.",
    schema: z.object({
      numAuctions: z.number().optional().describe("Number of auctions to create (default 3)"),
      itemsPerAuction: z.number().optional().describe("Target items per auction (default 300)"),
      maxDetail: z.number().optional().describe("Max products to evaluate in Phase 2 (default 500)"),
      publish: z.boolean().optional().describe("Publish auctions after creation"),
      dryRun: z.boolean().optional().describe("Score products only, don't create auctions"),
      buyerPremiumRate: z.number().optional().describe("Buyer premium rate, e.g. 0.15 for 15%"),
    }),
    handler: async (args) => {
      const result = await runSmartSource({
        numAuctions: (args.numAuctions as number) ?? 3,
        itemsPerAuction: (args.itemsPerAuction as number) ?? 300,
        maxDetail: (args.maxDetail as number) ?? 500,
        publish: (args.publish as boolean) ?? false,
        dryRun: (args.dryRun as boolean) ?? false,
        buyerPremiumRate: (args.buyerPremiumRate as number) ?? 0.15,
      });
      return ok(result);
    },
  },

  // ── Basta Query Tools ──────────────────────────────────────────────
  {
    name: "basta_get_sale_status",
    description:
      "Get the status of a specific Basta sale including all its items, their statuses, leaders, and current bids.",
    schema: z.object({
      saleId: z.string().describe("Basta sale ID"),
    }),
    handler: async (args) => {
      const result = await getSaleStatus(args.saleId as string);
      return ok(result);
    },
  },
  {
    name: "basta_fetch_closed_sales",
    description:
      "Fetch all CLOSED sales from Basta. Returns sale IDs, statuses, and titles.",
    schema: z.object({}),
    handler: async () => {
      const result = await fetchClosedSales();
      return ok(result);
    },
  },
  {
    name: "basta_fetch_sale_items",
    description:
      "Fetch all items for a specific Basta sale including their statuses, leaders, and current bids.",
    schema: z.object({
      saleId: z.string().describe("Basta sale ID"),
    }),
    handler: async (args) => {
      const result = await fetchSaleItems(args.saleId as string);
      return ok(result);
    },
  },

  // ── Lot Query Tools ────────────────────────────────────────────────
  {
    name: "lot_get_by_id",
    description: "Get a single dropship lot by its ID. Returns full lot data including CJ, Basta, Stripe, and fulfillment fields.",
    schema: z.object({
      lotId: z.string().describe("Dropship lot ID"),
    }),
    handler: async (args) => {
      const lot = await getDropshipLotById(args.lotId as string);
      if (!lot) return err(`Lot not found: ${args.lotId}`);
      return ok(lot);
    },
  },
  {
    name: "lot_get_by_status",
    description: "Get all dropship lots with a specific status. Returns array of lots.",
    schema: z.object({
      status: z.string().describe("Lot status (e.g. SOURCED, LISTED, PUBLISHED, PAID, SHIPPED, DELIVERED, etc.)"),
    }),
    handler: async (args) => {
      const lots = await getDropshipLotsByStatus(args.status as DropshipLotStatus);
      return ok(lots.map((l) => ({
        id: l.id,
        status: l.status,
        product: l.cj_product_name,
        costCents: l.cj_cost_cents + l.cj_shipping_cents,
        winningBid: l.winning_bid_cents,
        updatedAt: l.updated_at,
      })));
    },
  },
  {
    name: "lot_get_by_sale",
    description: "Get all dropship lots for a specific Basta sale.",
    schema: z.object({
      saleId: z.string().describe("Basta sale ID"),
    }),
    handler: async (args) => {
      const lots = await getDropshipLotsBySale(args.saleId as string);
      return ok(lots);
    },
  },
  {
    name: "lot_get_all",
    description: "Get all dropship lots. Warning: may be large. Prefer lot_get_status_counts or lot_get_by_status for targeted queries.",
    schema: z.object({}),
    handler: async () => {
      const lots = await getAllDropshipLots();
      return ok(lots.map((l) => ({
        id: l.id,
        status: l.status,
        product: l.cj_product_name,
        costCents: l.cj_cost_cents + l.cj_shipping_cents,
        winningBid: l.winning_bid_cents,
        saleId: l.basta_sale_id,
        updatedAt: l.updated_at,
      })));
    },
  },
  {
    name: "lot_get_status_counts",
    description: "Get lot counts grouped by status. Lightweight dashboard query.",
    schema: z.object({}),
    handler: async () => {
      const counts = await getDropshipLotStatusCounts();
      return ok(counts);
    },
  },

  // ── Lot Update ─────────────────────────────────────────────────────
  {
    name: "lot_update",
    description:
      "Update a dropship lot. If changing status, the transition is validated against the state machine. Invalid transitions are rejected.",
    schema: z.object({
      lotId: z.string().describe("Dropship lot ID"),
      updates: z.object({
        status: z.string().optional().describe("New status (validated against state machine)"),
        error_message: z.string().optional().describe("Error message to set"),
        tracking_number: z.string().optional(),
        tracking_carrier: z.string().optional(),
      }),
    }),
    handler: async (args) => {
      const lotId = args.lotId as string;
      const updates = args.updates as Record<string, unknown>;

      // Validate status transition if status is being changed
      if (updates.status) {
        const lot = await getDropshipLotById(lotId);
        if (!lot) return err(`Lot not found: ${lotId}`);

        const valid = validateTransition(
          lot.status as DropshipLotStatus,
          updates.status as DropshipLotStatus
        );
        if (!valid) {
          return err(
            `Invalid status transition: ${lot.status} → ${updates.status}. ` +
            `Check the state machine for valid transitions.`
          );
        }
      }

      await updateDropshipLot(lotId, updates as Record<string, string | number | null>);
      return ok({ updated: true, lotId, updates });
    },
  },

  // ── Keyword Tools ──────────────────────────────────────────────────
  {
    name: "keyword_list",
    description: "List all sourcing keywords with their stats (run counts, last sourced date, active status).",
    schema: z.object({}),
    handler: async () => {
      const keywords = await listKeywords();
      return ok(keywords);
    },
  },
  {
    name: "keyword_add",
    description: "Add a new sourcing keyword to the rotation.",
    schema: z.object({
      keyword: z.string().describe("CJ search keyword"),
      maxCostUsd: z.number().optional().describe("Max wholesale cost in USD (default 50)"),
      maxProducts: z.number().optional().describe("Max products per sourcing run (default 5)"),
      priority: z.number().optional().describe("Priority (higher = sourced first, default 0)"),
    }),
    handler: async (args) => {
      const id = await insertKeyword({
        keyword: args.keyword as string,
        maxCostUsd: args.maxCostUsd as number | undefined,
        maxProducts: args.maxProducts as number | undefined,
        priority: args.priority as number | undefined,
      });
      return ok({ created: true, keywordId: id, keyword: args.keyword });
    },
  },
];
