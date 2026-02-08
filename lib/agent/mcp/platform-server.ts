/**
 * Platform Tool Server — 5 tools wrapping Basta queries, auction pricing,
 * alerts, and email functions.
 */

import { z } from "zod";
import type { ToolDefinition, ToolResult } from "../types";
import {
  computePricing,
  computeReserve,
  computeStartingBid,
} from "@/lib/auction-pricing";
import { sendAlert } from "@/lib/alerts";
import { sendEmail, type EmailTemplate } from "@/lib/email";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function ok(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// Platform Tools
// ---------------------------------------------------------------------------

export const platformTools: ToolDefinition[] = [
  // ── Pricing tools ──────────────────────────────────────────────────
  {
    name: "pricing_compute",
    description:
      "Compute complete auction pricing: reserve, starting bid, break-even, worst-case profit, and markup. Uses the financial model that guarantees non-negative profit.",
    schema: z.object({
      productCostCents: z.number().describe("CJ product cost in cents"),
      shippingCostCents: z.number().describe("CJ shipping cost in cents"),
      buyerPremiumRate: z.number().describe("Buyer premium rate (e.g. 0.15 for 15%)"),
      suggestedRetailCents: z.number().optional().describe("CJ suggested retail price in cents"),
      safetyMargin: z.number().optional().describe("Override safety margin (default 0.05 = 5%)"),
      priceFluctuationBuffer: z.number().optional().describe("Override CJ price buffer (default 0.20 = 20%)"),
    }),
    handler: async (args) => {
      const result = computePricing({
        productCostCents: args.productCostCents as number,
        shippingCostCents: args.shippingCostCents as number,
        buyerPremiumRate: args.buyerPremiumRate as number,
        suggestedRetailCents: args.suggestedRetailCents as number | undefined,
        safetyMargin: args.safetyMargin as number | undefined,
        priceFluctuationBuffer: args.priceFluctuationBuffer as number | undefined,
      });
      return ok(result);
    },
  },
  {
    name: "pricing_compute_reserve",
    description:
      "Compute the minimum reserve price in cents that guarantees non-negative profit after all fees.",
    schema: z.object({
      productCostCents: z.number().describe("CJ product cost in cents"),
      shippingCostCents: z.number().describe("CJ shipping cost in cents"),
      buyerPremiumRate: z.number().describe("Buyer premium rate"),
      safetyMargin: z.number().optional(),
      priceFluctuationBuffer: z.number().optional(),
    }),
    handler: async (args) => {
      const reserve = computeReserve({
        productCostCents: args.productCostCents as number,
        shippingCostCents: args.shippingCostCents as number,
        buyerPremiumRate: args.buyerPremiumRate as number,
        safetyMargin: args.safetyMargin as number | undefined,
        priceFluctuationBuffer: args.priceFluctuationBuffer as number | undefined,
      });
      return ok({ reserveCents: reserve });
    },
  },
  {
    name: "pricing_compute_starting_bid",
    description:
      "Compute a penny-staggered starting bid for auction psychology. Returns non-round cent amounts.",
    schema: z.object({
      productCostCents: z.number().describe("CJ product cost in cents"),
      shippingCostCents: z.number().describe("CJ shipping cost in cents"),
      buyerPremiumRate: z.number().describe("Buyer premium rate"),
      suggestedRetailCents: z.number().optional(),
    }),
    handler: async (args) => {
      const bid = computeStartingBid({
        productCostCents: args.productCostCents as number,
        shippingCostCents: args.shippingCostCents as number,
        buyerPremiumRate: args.buyerPremiumRate as number,
        suggestedRetailCents: args.suggestedRetailCents as number | undefined,
      });
      return ok({ startingBidCents: bid });
    },
  },

  // ── Alert tool ─────────────────────────────────────────────────────
  {
    name: "alert_send",
    description:
      "Send a pipeline alert via email and webhook (if configured). Use for important operational notifications.",
    schema: z.object({
      message: z.string().describe("Alert message text"),
      severity: z.enum(["info", "warning", "critical"]).optional().describe("Alert severity level (default: warning)"),
    }),
    handler: async (args) => {
      await sendAlert(
        args.message as string,
        (args.severity as "info" | "warning" | "critical" | undefined) ?? "warning"
      );
      return ok({ sent: true, message: args.message, severity: args.severity ?? "warning" });
    },
  },

  // ── Email tool ─────────────────────────────────────────────────────
  {
    name: "email_send",
    description:
      "Send a transactional email to a user. Available templates: auction_won, payment_received, order_shipped, order_delivered, order_refunded.",
    schema: z.object({
      to: z.string().describe("Recipient email address"),
      template: z.enum([
        "auction_won",
        "payment_received",
        "order_shipped",
        "order_delivered",
        "order_refunded",
      ]).describe("Email template name"),
      data: z.record(z.unknown()).describe("Template data (productName, amount, trackingNumber, etc.)"),
    }),
    handler: async (args) => {
      await sendEmail({
        to: args.to as string,
        template: args.template as EmailTemplate,
        data: args.data as Record<string, string | number | null>,
      });
      return ok({ sent: true, to: args.to, template: args.template });
    },
  },
];
