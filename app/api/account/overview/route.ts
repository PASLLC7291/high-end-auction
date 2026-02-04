import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPaymentMethod } from "@/lib/payment-profile";
import { countWatchlistItems } from "@/lib/watchlist";
import { countPaymentOrderItemsByUser } from "@/lib/db";
import { getAccountId, getClientApiClient, getManagementApiClient } from "@/lib/basta-client";

type RecentBid = {
    saleId: string;
    itemId: string;
    auctionTitle?: string;
    lotTitle?: string;
    lotNumber?: number;
    currency?: string | null;
    currentBid?: number | null;
    yourMaxBid?: number;
    bidStatus?: string | null;
    closingDate?: string | null;
    lastBidDate?: string;
};

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

    const [paymentOk, watchlistCount, wonCount] = await Promise.all([
        hasPaymentMethod(session.user.id),
        countWatchlistItems(session.user.id),
        countPaymentOrderItemsByUser(session.user.id),
    ]);

    // Prefer Basta client API `me` query (doc-recommended) when a bidder token exists.
    if (session.bidderToken) {
        try {
            const client = getClientApiClient(session.bidderToken);
            const res = await client.query({
                me: {
                    latestItemBids: {
                        __args: { first: 50 },
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

            const recent: Array<RecentBid & { itemStatus?: string | null }> = nodes.map((node) => {
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
                    auctionTitle: saleTitles.get(node.saleId),
                    lotTitle: node.title ?? undefined,
                    lotNumber: node.itemNumber ?? undefined,
                    currency: node.currency ?? null,
                    currentBid: node.currentBid ?? null,
                    yourMaxBid: latestUserBid?.maxAmount ?? latestUserBid?.amount,
                    bidStatus: (node.bidStatus ?? latestUserBid?.bidStatus) ?? null,
                    closingDate: node.dates?.closingEnd ?? null,
                    lastBidDate: latestUserBid?.date,
                    itemStatus: node.status ?? null,
                };
            });

            const activeBidsCount = recent.filter(
                (b) => b.itemStatus === "ITEM_OPEN" || b.itemStatus === "ITEM_CLOSING"
            ).length;

            const recentBids = recent
                .sort(
                    (a, b) =>
                        new Date(b.lastBidDate ?? 0).getTime() -
                        new Date(a.lastBidDate ?? 0).getTime()
                )
                .slice(0, 3)
                .map(({ itemStatus: _itemStatus, ...rest }) => rest);

            return NextResponse.json({
                stats: {
                    activeBids: activeBidsCount,
                    watchlistItems: watchlistCount,
                    wonItems: wonCount,
                },
                hasPaymentMethod: paymentOk,
                recentBids,
            });
        } catch (error) {
            console.error("Overview fetch (me) error:", error);
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
                    saleId: true,
                    itemId: true,
                    amount: true,
                    maxAmount: true,
                    date: true,
                    bidStatus: true,
                    sale: { title: true },
                    saleItem: {
                        itemNumber: true,
                        title: true,
                        status: true,
                        currentBid: true,
                        dates: { closingEnd: true },
                    },
                },
            },
        },
    });

    const edges = res.userBidActivity?.edges ?? [];
    const byItem = new Map<string, RecentBid & { itemStatus?: string | null }>();

    for (const edge of edges) {
        const node = edge?.node;
        if (!node) continue;

        const key = `${node.saleId}:${node.itemId}`;
        const next = {
            saleId: node.saleId,
            itemId: node.itemId,
            auctionTitle: node.sale?.title ?? undefined,
            lotTitle: node.saleItem?.title ?? undefined,
            lotNumber: node.saleItem?.itemNumber ?? undefined,
            currentBid: node.saleItem?.currentBid ?? null,
            currency: node.saleItem?.currency ?? null,
            yourMaxBid: node.maxAmount ?? node.amount,
            bidStatus: node.bidStatus ?? null,
            closingDate: node.saleItem?.dates?.closingEnd ?? null,
            lastBidDate: node.date,
            itemStatus: node.saleItem?.status ?? null,
        } as const;

        const existing = byItem.get(key);
        if (!existing) {
            byItem.set(key, next);
            continue;
        }

        if (new Date(next.lastBidDate ?? 0).getTime() > new Date(existing.lastBidDate ?? 0).getTime()) {
            byItem.set(key, next);
        }
    }

    const grouped = Array.from(byItem.values());

    const activeBidsCount = grouped.filter((b) =>
        b.itemStatus === "ITEM_OPEN" || b.itemStatus === "ITEM_CLOSING"
    ).length;

    const recentBids = grouped
        .sort((a, b) => new Date(b.lastBidDate ?? 0).getTime() - new Date(a.lastBidDate ?? 0).getTime())
        .slice(0, 3)
        .map(({ itemStatus: _itemStatus, ...rest }) => rest);

    return NextResponse.json({
        stats: {
            activeBids: activeBidsCount,
            watchlistItems: watchlistCount,
            wonItems: wonCount,
        },
        hasPaymentMethod: paymentOk,
        recentBids,
    });
}
