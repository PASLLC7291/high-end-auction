/**
 * Supplier Tool Server — 8 tools wrapping lib/cj-client.ts for CJ Dropshipping.
 */

import { z } from "zod";
import type { ToolDefinition, ToolResult } from "../types";
import { getCJClient } from "@/lib/cj-client";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function ok(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// Supplier Tools
// ---------------------------------------------------------------------------

export const supplierTools: ToolDefinition[] = [
  // ── Read-only CJ tools ─────────────────────────────────────────────
  {
    name: "cj_search_products",
    description:
      "Search CJ Dropshipping product catalog. Returns product list with prices, inventory, and images.",
    schema: z.object({
      keyWord: z.string().optional().describe("Search keyword"),
      categoryId: z.string().optional().describe("CJ category ID"),
      page: z.number().optional().describe("Page number (default 1)"),
      size: z.number().optional().describe("Page size (default 20, max 200)"),
      countryCode: z.string().optional().describe("Target country code (default US)"),
      startSellPrice: z.number().optional().describe("Minimum sell price filter"),
      endSellPrice: z.number().optional().describe("Maximum sell price filter"),
      orderBy: z.number().optional().describe("Sort: 0=match, 1=listings, 2=price, 3=date, 4=inventory"),
      sort: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    }),
    handler: async (args) => {
      const cj = getCJClient();
      const result = await cj.searchProducts({
        keyWord: args.keyWord as string | undefined,
        categoryId: args.categoryId as string | undefined,
        page: args.page as number | undefined,
        size: args.size as number | undefined,
        countryCode: (args.countryCode as string | undefined) ?? "US",
        startSellPrice: args.startSellPrice as number | undefined,
        endSellPrice: args.endSellPrice as number | undefined,
        orderBy: args.orderBy as number | undefined,
        sort: args.sort as "asc" | "desc" | undefined,
      });
      return ok(result);
    },
  },
  {
    name: "cj_get_product",
    description:
      "Get full product details from CJ including variants, images, description, and pricing. Provide one of: pid, productSku, or variantSku.",
    schema: z.object({
      pid: z.string().optional().describe("CJ product ID"),
      productSku: z.string().optional().describe("CJ product SKU"),
      variantSku: z.string().optional().describe("CJ variant SKU"),
    }),
    handler: async (args) => {
      const cj = getCJClient();
      const result = await cj.getProduct({
        pid: args.pid as string | undefined,
        productSku: args.productSku as string | undefined,
        variantSku: args.variantSku as string | undefined,
      });
      return ok(result);
    },
  },
  {
    name: "cj_get_inventory",
    description:
      "Get inventory levels for a CJ product by product ID. Returns stock by warehouse/country.",
    schema: z.object({
      pid: z.string().describe("CJ product ID"),
    }),
    handler: async (args) => {
      const cj = getCJClient();
      const result = await cj.getInventoryByProduct(args.pid as string);
      return ok(result);
    },
  },
  {
    name: "cj_calculate_freight",
    description:
      "Calculate shipping cost for CJ products. Returns available logistics options with pricing and delivery times.",
    schema: z.object({
      startCountryCode: z.string().describe("Origin country code (e.g. CN)"),
      endCountryCode: z.string().describe("Destination country code (e.g. US)"),
      products: z.array(
        z.object({
          vid: z.string().describe("CJ variant ID"),
          quantity: z.number().describe("Quantity"),
        })
      ).describe("Products to ship"),
      zip: z.string().optional().describe("Destination ZIP code for more accurate rates"),
    }),
    handler: async (args) => {
      const cj = getCJClient();
      const result = await cj.calculateFreight({
        startCountryCode: args.startCountryCode as string,
        endCountryCode: args.endCountryCode as string,
        products: args.products as Array<{ vid: string; quantity: number }>,
        zip: args.zip as string | undefined,
      });
      return ok(result);
    },
  },

  // ── Write tools ─────────────────────────────────────────────────────
  {
    name: "cj_create_order",
    description:
      "Create a CJ Dropshipping order for fulfillment. Requires shipping address details and product variants.",
    schema: z.object({
      orderNumber: z.string().describe("Your internal order number"),
      shippingCountryCode: z.string().describe("Shipping country code"),
      shippingCustomerName: z.string().describe("Customer name"),
      shippingAddress: z.string().describe("Street address"),
      shippingCity: z.string().describe("City"),
      shippingProvince: z.string().describe("State/Province"),
      shippingZip: z.string().optional().describe("ZIP/Postal code"),
      shippingPhone: z.string().optional().describe("Phone number"),
      logisticName: z.string().describe("Logistics provider name"),
      fromCountryCode: z.string().describe("Origin country code"),
      products: z.array(
        z.object({
          vid: z.string().describe("CJ variant ID"),
          quantity: z.number().describe("Quantity"),
        })
      ).describe("Products to order"),
    }),
    handler: async (args) => {
      const cj = getCJClient();
      const result = await cj.createOrder({
        orderNumber: args.orderNumber as string,
        shippingCountryCode: args.shippingCountryCode as string,
        shippingCustomerName: args.shippingCustomerName as string,
        shippingAddress: args.shippingAddress as string,
        shippingCity: args.shippingCity as string,
        shippingProvince: args.shippingProvince as string,
        shippingZip: args.shippingZip as string | undefined,
        shippingPhone: args.shippingPhone as string | undefined,
        logisticName: args.logisticName as string,
        fromCountryCode: args.fromCountryCode as string,
        products: args.products as Array<{ vid: string; quantity: number }>,
      });
      return ok(result);
    },
  },
  {
    name: "cj_pay_order",
    description:
      "Pay a CJ order from CJ account balance. This triggers CJ to start processing/shipping the order.",
    schema: z.object({
      orderId: z.string().describe("CJ order ID to pay"),
    }),
    handler: async (args) => {
      const cj = getCJClient();
      await cj.payOrder(args.orderId as string);
      return ok({ paid: true, orderId: args.orderId });
    },
  },

  // ── Query tools ────────────────────────────────────────────────────
  {
    name: "cj_get_order_detail",
    description:
      "Get details of a CJ order including status, amount, tracking number, and logistics info.",
    schema: z.object({
      orderId: z.string().describe("CJ order ID"),
    }),
    handler: async (args) => {
      const cj = getCJClient();
      const result = await cj.getOrderDetail(args.orderId as string);
      return ok(result);
    },
  },
  {
    name: "cj_get_balance",
    description:
      "Get current CJ account balance. Shows available amount and frozen amount.",
    schema: z.object({}),
    handler: async () => {
      const cj = getCJClient();
      const result = await cj.getBalance();
      return ok(result);
    },
  },
];
