import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccountId, getClientApiClient, getManagementApiClient } from "@/lib/basta-client";

type WonItemView = {
    saleId: string;
    itemId: string;
    lotNumber?: number;
    lotTitle?: string;
    image?: string;
    hammerPrice?: number | null;
    currency?: string | null;
    itemStatus?: string | null;
    closingDate?: string | null;
};

type WonOrderView = {
    bastaOrderId: string;
    saleId: string;
    auctionTitle?: string;
    status?: string | null;
    invoiceUrl?: string | null;
    createdAt: string;
    items: WonItemView[];
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchSaleTitle(client: ReturnType<typeof getClientApiClient>, saleId: string): Promise<string | undefined> {
    try {
        const res = await client.query({
            sale: {
                __args: { id: saleId },
                title: true,
            },
        });
        return res.sale?.title ?? undefined;
    } catch {
        return undefined;
    }
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mgmt = getManagementApiClient();
    const accountId = getAccountId();
    const clientApi = getClientApiClient();

    const res = await mgmt.query({
        userOrders: {
            __args: {
                accountId,
                userID: session.user.id,
                first: 50,
            },
            edges: {
                node: {
                    id: true,
                    title: true,
                    currency: true,
                    saleId: true,
                    itemId: true,
                    status: true,
                    invoiceId: true,
                    invoice: {
                        invoiceId: true,
                        url: true,
                        dueDate: true,
                    },
                    paymentId: true,
                    orderLines: {
                        amount: true,
                        description: true,
                        item: {
                            on_SaleItem: {
                                __typename: true,
                                id: true,
                                title: true,
                                itemNumber: true,
                                currentBid: true,
                                currency: true,
                                status: true,
                                images: { url: true },
                                dates: { closingEnd: true },
                            },
                            on_Item: {
                                __typename: true,
                                id: true,
                                title: true,
                            },
                        },
                    },
                    created: true,
                },
            },
            pageInfo: {
                totalRecords: true,
            },
        },
    });

    const edges = res.userOrders?.edges ?? [];

    // Cache sale titles
    const saleTitleCache = new Map<string, Promise<string | undefined>>();
    const getTitle = (saleId: string) => {
        if (!saleTitleCache.has(saleId)) {
            saleTitleCache.set(saleId, fetchSaleTitle(clientApi, saleId));
        }
        return saleTitleCache.get(saleId)!;
    };

    const orderViews: WonOrderView[] = [];

    for (const edge of edges) {
        const order = edge?.node;
        if (!order) continue;

        const auctionTitle = await getTitle(order.saleId);

        // Extract item details from order lines
        const items: WonItemView[] = [];
        for (const line of order.orderLines ?? []) {
            const saleItem = line?.item;
            if (saleItem && '__typename' in saleItem && saleItem.__typename === 'SaleItem') {
                const si = saleItem as {
                    id: string;
                    title?: string | null;
                    itemNumber?: number;
                    currentBid?: number | null;
                    currency?: string;
                    status?: string;
                    images?: Array<{ url?: string | null }>;
                    dates?: { closingEnd?: string | null };
                };
                items.push({
                    saleId: order.saleId,
                    itemId: si.id,
                    lotNumber: si.itemNumber,
                    lotTitle: si.title ?? undefined,
                    image: si.images?.[0]?.url ?? undefined,
                    hammerPrice: si.currentBid ?? line.amount ?? null,
                    currency: si.currency ?? order.currency ?? null,
                    itemStatus: si.status ?? null,
                    closingDate: si.dates?.closingEnd ?? null,
                });
            } else {
                // Fallback: use order-level data
                items.push({
                    saleId: order.saleId,
                    itemId: order.itemId,
                    hammerPrice: line?.amount ?? null,
                    currency: order.currency ?? null,
                });
            }
        }

        // If no order lines but we have an itemId, add a basic entry
        if (items.length === 0 && order.itemId) {
            items.push({
                saleId: order.saleId,
                itemId: order.itemId,
                currency: order.currency ?? null,
            });
        }

        orderViews.push({
            bastaOrderId: order.id,
            saleId: order.saleId,
            auctionTitle,
            status: order.status ?? null,
            invoiceUrl: order.invoice?.url ?? null,
            createdAt: order.created,
            items,
        });
    }

    return NextResponse.json({ orders: orderViews });
}
