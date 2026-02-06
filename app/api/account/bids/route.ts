import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccountId, getClientApiClient, getManagementApiClient } from "@/lib/basta-client";

type BidItem = {
    saleId: string;
    itemId: string;
    lotNumber?: number;
    lotTitle?: string;
    auctionTitle?: string;
    image?: string;
    currency?: string | null;
    currentBid?: number | null;
    yourBid?: number;
    yourMaxBid?: number;
    bidStatus?: string | null;
    itemStatus?: string | null;
    closingDate?: string | null;
    lastBidDate?: string;
};

function isPastItemStatus(status?: string | null): boolean {
    return Boolean(
        status &&
        ["ITEM_CLOSED", "ITEM_SOLD", "ITEM_WITHDRAWN", "ITEM_PASSED", "ITEM_PROCESSING"].includes(status)
    );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchSaleTitles(
    client: ReturnType<typeof getClientApiClient>,
    saleIds: string[]
): Promise<Map<string, string | undefined>> {
    const titles = new Map<string, string | undefined>();
    await Promise.all(
        saleIds.map(async (saleId) => {
            if (titles.has(saleId)) return;
            try {
                const res = await client.query({
                    sale: {
                        __args: { id: saleId },
                        title: true,
                    },
                });
                titles.set(saleId, res.sale?.title ?? undefined);
            } catch {
                titles.set(saleId, undefined);
            }
        })
    );
    return titles;
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prefer Basta client API `me` query (doc-recommended) when a bidder token exists.
    if (session.bidderToken) {
        try {
            const client = getClientApiClient(session.bidderToken);
            const res = await client.query({
                me: {
                    latestItemBids: {
                        __args: { first: 200 },
                        edges: {
                            node: {
                                id: true,
                                saleId: true,
                                itemNumber: true,
                                title: true,
                                status: true,
                                currency: true,
                                currentBid: true,
                                bidStatus: true,
                                images: { url: true },
                                dates: { closingEnd: true },
                                userBids: {
                                    id: true,
                                    amount: true,
                                    maxAmount: true,
                                    date: true,
                                    bidStatus: true,
                                },
                            },
                        },
                        pageInfo: {
                            totalRecords: true,
                        },
                    },
                },
            });

            const edges = res.me?.latestItemBids?.edges ?? [];
            const nodes = edges
                .map((edge) => edge?.node)
                .filter(Boolean) as Array<{
                id: string;
                saleId: string;
                itemNumber: number;
                title?: string | null;
                status?: string | null;
                currency?: string | null;
                currentBid?: number | null;
                bidStatus?: string | null;
                images?: Array<{ url?: string | null }> | null;
                dates?: { closingEnd?: string | null } | null;
                userBids?: Array<{
                    id: string;
                    amount: number;
                    maxAmount?: number | null;
                    date: string;
                    bidStatus?: string | null;
                }> | null;
            }>;

            const saleIds = Array.from(new Set(nodes.map((n) => n.saleId)));
            const saleTitles = await fetchSaleTitles(client, saleIds);

            const items: BidItem[] = nodes.map((node) => {
                const userBids = Array.isArray(node.userBids) ? node.userBids : [];
                const latestUserBid = userBids.reduce<
                    (typeof userBids)[number] | undefined
                >((latest, next) => {
                    if (!latest) return next;
                    return new Date(next.date).getTime() > new Date(latest.date).getTime()
                        ? next
                        : latest;
                }, undefined);

                return {
                    saleId: node.saleId,
                    itemId: node.id,
                    lotNumber: node.itemNumber ?? undefined,
                    lotTitle: node.title ?? undefined,
                    auctionTitle: saleTitles.get(node.saleId),
                    image: node.images?.[0]?.url ?? undefined,
                    currency: node.currency ?? null,
                    currentBid: node.currentBid ?? null,
                    yourBid: latestUserBid?.amount,
                    yourMaxBid: latestUserBid?.maxAmount ?? latestUserBid?.amount,
                    bidStatus: (node.bidStatus ?? latestUserBid?.bidStatus) ?? null,
                    itemStatus: node.status ?? null,
                    closingDate: node.dates?.closingEnd ?? null,
                    lastBidDate: latestUserBid?.date,
                };
            });

            items.sort(
                (a, b) =>
                    new Date(b.lastBidDate ?? 0).getTime() -
                    new Date(a.lastBidDate ?? 0).getTime()
            );

            return NextResponse.json({
                items,
                total: res.me?.latestItemBids?.pageInfo?.totalRecords ?? items.length,
            });
        } catch (error) {
            console.error("Bids fetch (me) error:", error);
            // Fall back to management API query below.
        }
    }

    const client = getManagementApiClient();
    const accountId = getAccountId();

    const res = await client.query({
        userBidActivity: {
            __args: {
                accountId,
                userId: session.user.id,
                first: 200,
                direction: "BACKWARDS",
                orderBy: "BID_DATE",
            },
            edges: {
                node: {
                    bidId: true,
                    saleId: true,
                    itemId: true,
                    amount: true,
                    maxAmount: true,
                    date: true,
                    bidStatus: true,
                    sale: {
                        id: true,
                        title: true,
                        status: true,
                    },
                    saleItem: {
                        id: true,
                        itemNumber: true,
                        title: true,
                        status: true,
                        currentBid: true,
                        currency: true,
                        dates: {
                            closingEnd: true,
                        },
                        images: { url: true },
                    },
                },
            },
            pageInfo: {
                totalRecords: true,
            },
        },
    });

    const edges = res.userBidActivity?.edges ?? [];

    const byItem = new Map<string, BidItem>();

    for (const edge of edges) {
        const node = edge?.node;
        if (!node) continue;

        const key = `${node.saleId}:${node.itemId}`;
        const existing = byItem.get(key);
        const next: BidItem = {
            saleId: node.saleId,
            itemId: node.itemId,
            lotNumber: node.saleItem?.itemNumber ?? undefined,
            lotTitle: node.saleItem?.title ?? undefined,
            auctionTitle: node.sale?.title ?? undefined,
            image: node.saleItem?.images?.[0]?.url ?? undefined,
            currency: node.saleItem?.currency ?? null,
            currentBid: node.saleItem?.currentBid ?? null,
            yourBid: node.amount,
            yourMaxBid: node.maxAmount ?? node.amount,
            bidStatus: node.bidStatus ?? null,
            itemStatus: node.saleItem?.status ?? null,
            closingDate: node.saleItem?.dates?.closingEnd ?? null,
            lastBidDate: node.date,
        };

        if (!existing) {
            byItem.set(key, next);
            continue;
        }

        // Keep the most recent bid activity for this item
        if (new Date(next.lastBidDate ?? 0).getTime() > new Date(existing.lastBidDate ?? 0).getTime()) {
            byItem.set(key, next);
        }
    }

    // Management API returns per-bid status (WINNING/LOSING) that doesn't
    // resolve to WON/LOST after the item closes. Derive final status from
    // item status for closed items.
    for (const item of byItem.values()) {
        if (isPastItemStatus(item.itemStatus)) {
            if (item.bidStatus === "WINNING") {
                item.bidStatus = "WON";
            } else if (item.bidStatus === "LOSING") {
                item.bidStatus = "LOST";
            }
        }
    }

    const items = Array.from(byItem.values()).sort((a, b) => {
        const aTime = new Date(a.lastBidDate ?? 0).getTime();
        const bTime = new Date(b.lastBidDate ?? 0).getTime();
        return bTime - aTime;
    });

    return NextResponse.json({ items, total: res.userBidActivity?.pageInfo?.totalRecords ?? items.length });
}
