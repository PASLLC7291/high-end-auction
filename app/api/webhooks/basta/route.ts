import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAccountId, getManagementApiClient } from "@/lib/basta-client";
import { stripe } from "@/lib/stripe";
import { getPaymentProfile } from "@/lib/payment-profile";
import type { managementApiSchema } from "@bastaai/basta-js";
import {
    markWebhookProcessed,
    getPaymentOrderBySaleAndUser,
    insertPaymentOrder,
    updatePaymentOrder,
    getProcessedItemIds,
    upsertPaymentOrderItem,
} from "@/lib/db";

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

async function ensureOrderForUser(params: {
    saleId: string;
    userId: string;
    currency: managementApiSchema.Currency;
    orderLines: { itemId: string; amount: number; description: string }[];
}): Promise<{ orderId: string; hasInvoice: boolean }> {
    const { saleId, userId, currency, orderLines } = params;
    const accountId = getAccountId();
    const client = getManagementApiClient();

    const existingOrder = await getPaymentOrderBySaleAndUser(saleId, userId);

    if (existingOrder?.stripe_invoice_id) {
        return {
            orderId: existingOrder.basta_order_id,
            hasInvoice: true,
        };
    }

    if (!existingOrder) {
        const orderRes = await client.mutation({
            createOrder: {
                __args: {
                    accountId,
                    input: {
                        saleId,
                        userId,
                        title: `Order for sale ${saleId}`,
                        currency: currency,
                        orderLines: orderLines.map((line) => ({
                            itemId: line.itemId,
                            amount: line.amount,
                            description: line.description,
                        })),
                    },
                },
                id: true,
                status: true,
            },
        });

        const orderId = orderRes.createOrder?.id;
        if (!orderId) {
            throw new Error("Failed to create order");
        }

        await client.mutation({
            publishPaymentOrder: {
                __args: {
                    accountId,
                    input: { orderId },
                },
                id: true,
                status: true,
            },
        });

        await insertPaymentOrder({
            basta_order_id: orderId,
            sale_id: saleId,
            user_id: userId,
            status: "OPEN",
        });

        for (const line of orderLines) {
            await upsertPaymentOrderItem(orderId, line.itemId);
        }

        return { orderId, hasInvoice: false };
    }

    const orderId = existingOrder.basta_order_id;

    for (const line of orderLines) {
        await client.mutation({
            createOrderLine: {
                __args: {
                    accountId,
                    input: {
                        orderId,
                        itemId: line.itemId,
                        amount: line.amount,
                        description: line.description,
                    },
                },
                orderLineId: true,
            },
        });

        await upsertPaymentOrderItem(orderId, line.itemId);
    }

    return { orderId, hasInvoice: false };
}

async function createStripeInvoice(params: {
    saleId: string;
    userId: string;
    bastaOrderId: string;
    currency: managementApiSchema.Currency;
    lines: { itemId: string; amount: number; description: string }[];
}) {
    const { saleId, userId, bastaOrderId, currency, lines } = params;
    const profile = await getPaymentProfile(userId);
    if (!profile?.stripe_customer_id || !profile.default_payment_method_id) {
        throw new Error(`Missing payment profile for user ${userId}`);
    }

    const invoice = await stripe.invoices.create({
        customer: profile.stripe_customer_id,
        collection_method: "charge_automatically",
        auto_advance: true,
        automatic_tax: { enabled: true },
        default_payment_method: profile.default_payment_method_id,
        metadata: { saleId, userId, bastaOrderId },
    });

    for (const line of lines) {
        await stripe.invoiceItems.create({
            customer: profile.stripe_customer_id,
            invoice: invoice.id,
            amount: line.amount,
            currency: currency.toLowerCase(),
            description: line.description,
            metadata: { itemId: line.itemId, bastaOrderId },
        });
    }

    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

    await updatePaymentOrder(bastaOrderId, {
        stripe_invoice_id: finalized.id,
        stripe_invoice_url: finalized.hosted_invoice_url,
        status: "INVOICE_ISSUED",
    });

    const hostedUrl = finalized.hosted_invoice_url || finalized.invoice_pdf;
    if (!hostedUrl) {
        throw new Error("Stripe invoice missing hosted URL");
    }

    const client = getManagementApiClient();
    const accountId = getAccountId();
    const dueDate = new Date(
        ((finalized.due_date ?? finalized.created) as number) * 1000
    ).toISOString();

    await client.mutation({
        createInvoice: {
            __args: {
                accountId,
                input: {
                    orderId: bastaOrderId,
                    externalID: finalized.id,
                    url: hostedUrl,
                    dueDate,
                },
            },
            invoiceId: true,
            url: true,
        },
    });
}

async function processSaleClosed(saleId: string) {
    const { items, currency } = await fetchSaleItems(saleId);
    const processedSet = await getProcessedItemIds();

    const winningItems = items.filter(
        (item) =>
            item.status === "ITEM_CLOSED" &&
            item.leaderId &&
            item.currentBid &&
            !processedSet.has(item.id)
    );

    if (!winningItems.length) return;

    const grouped = new Map<
        string,
        { lines: { itemId: string; amount: number; description: string }[] }
    >();

    for (const item of winningItems) {
        const userId = item.leaderId as string;
        const line = {
            itemId: item.id,
            amount: item.currentBid as number,
            description: item.title ? `Winning bid: ${item.title}` : "Winning bid",
        };
        if (!grouped.has(userId)) {
            grouped.set(userId, { lines: [line] });
        } else {
            grouped.get(userId)!.lines.push(line);
        }
    }

    for (const [userId, group] of grouped.entries()) {
        try {
            const { orderId, hasInvoice } = await ensureOrderForUser({
                saleId,
                userId,
                currency,
                orderLines: group.lines,
            });

            if (!hasInvoice) {
                await createStripeInvoice({
                    saleId,
                    userId,
                    bastaOrderId: orderId,
                    currency,
                    lines: group.lines,
                });
            }
        } catch (userError) {
            // Log and continue so one user's failure doesn't block other winners
            console.error(`Failed to process invoice for user ${userId} in sale ${saleId}:`, userError);
        }
    }
}

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
            // If the shared token header isn't present, fall back to signature verification.
            // This supports both models:
            // - Basta-signed payloads (x-basta-signature + whsec_... secret)
            // - Shared secret header configured on Action Hook subscriptions (WEBHOOK_TOKEN_HEADER)
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
                await processSaleClosed(data.saleId);
            }
        }

        return NextResponse.json({ status: "ok" });
    } catch (error) {
        console.error("BASTA webhook error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
