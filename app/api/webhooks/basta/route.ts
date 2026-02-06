import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAccountId, getManagementApiClient } from "@/lib/basta-client";
import { processClosedItems, clearAccountFeesCache } from "@/lib/order-service";
import { markWebhookProcessed } from "@/lib/db";
import type { managementApiSchema } from "@bastaai/basta-js";

type ItemsStatusChangedPayload = {
    saleId: string;
    itemStatusChanges: { itemId: string; itemStatus: string }[];
};

type SaleStatusChangedPayload = {
    saleId: string;
    saleStatus: string;
};

type BastaWebhook = {
    idempotencyKey: string;
    actionType: string;
    data: ItemsStatusChangedPayload | SaleStatusChangedPayload | Record<string, unknown>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_TOKEN_HEADER = "x-fastbid-webhook-token";

function timingSafeEqualStrings(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
}

function isSignatureValid(params: {
    rawBody: string;
    signatureHeader: string;
    secret: string;
    toleranceSeconds?: number;
}) {
    const { rawBody, signatureHeader, secret, toleranceSeconds = 300 } = params;

    // Header format: t=<timestamp>,v1=<signature>
    const parts = Object.fromEntries(
        signatureHeader
            .split(",")
            .map((part) => part.trim())
            .map((part) => {
                const idx = part.indexOf("=");
                return idx === -1 ? [part, ""] : [part.slice(0, idx), part.slice(idx + 1)];
            })
    );

    const timestamp = Number(parts.t);
    const signature = parts.v1;

    if (!Number.isFinite(timestamp) || !signature) {
        return { valid: false, reason: "Invalid signature header format" as const };
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
        return { valid: false, reason: "Signature timestamp outside tolerance" as const };
    }

    const normalizedSecret = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
    const signedContent = `${timestamp}.${rawBody}`;
    const computed = crypto
        .createHmac("sha256", normalizedSecret)
        .update(signedContent)
        .digest("hex");

    try {
        const computedBuf = Buffer.from(computed);
        const receivedBuf = Buffer.from(signature);
        if (computedBuf.length !== receivedBuf.length) {
            return { valid: false, reason: "Invalid signature" as const };
        }
        return {
            valid: crypto.timingSafeEqual(computedBuf, receivedBuf),
            reason: "Invalid signature" as const,
        };
    } catch {
        return { valid: false, reason: "Invalid signature" as const };
    }
}

// ---------------------------------------------------------------------------
// Fetch sale items from Basta Management API (paginated)
// ---------------------------------------------------------------------------

type SaleItemNode = {
    id: string;
    status: string;
    leaderId?: string | null;
    currentBid?: number | null;
    title?: string | null;
    currency?: managementApiSchema.Currency | null;
};

type SaleItemsQueryResponse = {
    sale?: {
        currency?: managementApiSchema.Currency | null;
        items?: {
            edges?: Array<{ node?: SaleItemNode | null } | null> | null;
            pageInfo?: { hasNextPage: boolean; endCursor?: string | null } | null;
        } | null;
    } | null;
};

async function fetchSaleItems(saleId: string) {
    const client = getManagementApiClient();
    const accountId = getAccountId();

    let after: string | undefined = undefined;
    let saleCurrency: managementApiSchema.Currency | null = null;
    const items: SaleItemNode[] = [];

    while (true) {
        const response: SaleItemsQueryResponse = (await client.query({
            sale: {
                __args: { accountId, id: saleId },
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
                            currency: true,
                        },
                    },
                    pageInfo: {
                        hasNextPage: true,
                        endCursor: true,
                    },
                },
            },
        })) as unknown as SaleItemsQueryResponse;

        if (!response.sale) break;
        saleCurrency = saleCurrency ?? response.sale.currency ?? null;
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
// Handler: SaleStatusChanged → CLOSED
// ---------------------------------------------------------------------------

async function handleSaleClosed(saleId: string) {
    const { items, currency } = await fetchSaleItems(saleId);

    const closedItems = items
        .filter(
            (item) =>
                item.status === "ITEM_CLOSED" &&
                item.leaderId &&
                item.currentBid
        )
        .map((item) => ({
            itemId: item.id,
            leaderId: item.leaderId as string,
            currentBid: item.currentBid as number,
            title: item.title || "",
        }));

    // Clear fee cache so each webhook batch gets fresh data
    clearAccountFeesCache();

    await processClosedItems({ saleId, items: closedItems, currency });
}

// ---------------------------------------------------------------------------
// Handler: ItemsStatusChanged → individual ITEM_CLOSED
// ---------------------------------------------------------------------------

async function handleItemsClosed(saleId: string, closedItemIds: string[]) {
    if (!closedItemIds.length) return;

    const { items, currency } = await fetchSaleItems(saleId);

    const closedSet = new Set(closedItemIds);
    const closedItems = items
        .filter(
            (item) =>
                closedSet.has(item.id) &&
                item.status === "ITEM_CLOSED" &&
                item.leaderId &&
                item.currentBid
        )
        .map((item) => ({
            itemId: item.id,
            leaderId: item.leaderId as string,
            currentBid: item.currentBid as number,
            title: item.title || "",
        }));

    clearAccountFeesCache();

    await processClosedItems({ saleId, items: closedItems, currency });
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
    try {
        const signature = request.headers.get("x-basta-signature");
        const tokenHeader = request.headers.get(WEBHOOK_TOKEN_HEADER);
        const secret = process.env.BASTA_WEBHOOK_SECRET?.trim();

        if (!secret) {
            return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
        }

        const rawBody = await request.text();

        const tokenValid = (() => {
            const token = tokenHeader?.trim();
            if (!token) return false;
            try {
                return timingSafeEqualStrings(token, secret);
            } catch {
                return false;
            }
        })();

        const sigCheck =
            signature?.trim()
                ? isSignatureValid({
                    rawBody,
                    signatureHeader: signature,
                    secret,
                })
                : { valid: false as const, reason: "Missing signature" as const };

        if (!tokenValid && !sigCheck.valid) {
            return NextResponse.json({ error: sigCheck.reason }, { status: 401 });
        }

        const payload = JSON.parse(rawBody) as BastaWebhook;
        if (!payload?.idempotencyKey) {
            return NextResponse.json({ error: "Missing idempotencyKey" }, { status: 400 });
        }

        const processed = await markWebhookProcessed("basta", payload.idempotencyKey, payload);
        if (!processed) {
            return NextResponse.json({ status: "ignored" });
        }

        if (payload.actionType === "SaleStatusChanged") {
            const data = payload.data as SaleStatusChangedPayload;
            if (data.saleStatus === "CLOSED") {
                await handleSaleClosed(data.saleId);
            }
        }

        if (payload.actionType === "ItemsStatusChanged") {
            const data = payload.data as ItemsStatusChangedPayload;
            const closedItemIds = data.itemStatusChanges
                .filter((c) => c.itemStatus === "ITEM_CLOSED")
                .map((c) => c.itemId);

            if (closedItemIds.length) {
                await handleItemsClosed(data.saleId, closedItemIds);
            }
        }

        return NextResponse.json({ status: "ok" });
    } catch (error) {
        console.error("BASTA webhook error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
