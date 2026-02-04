import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addWatchlistItem, listWatchlistItems, removeWatchlistItem } from "@/lib/watchlist";
import { getClientApiClient } from "@/lib/basta-client";

type WatchlistItemView = {
    id: string;
    saleId: string;
    itemId: string;
    createdAt: string;
    lotNumber?: number;
    lotTitle?: string;
    auctionTitle?: string;
    image?: string;
    currency?: string | null;
    currentBid?: number | null;
    startingBid?: number | null;
    lowEstimate?: number | null;
    highEstimate?: number | null;
    closingDate?: string | null;
    status?: string;
};

async function enrichWatchlistItem(entry: { id: string; sale_id: string; item_id: string; created_at: string }): Promise<WatchlistItemView> {
    const client = getClientApiClient();

    try {
        const result = await client.query({
            saleItem: {
                __args: { saleId: entry.sale_id, itemId: entry.item_id },
                id: true,
                itemNumber: true,
                title: true,
                status: true,
                currency: true,
                currentBid: true,
                startingBid: true,
                estimates: { low: true, high: true },
                images: { url: true },
                dates: { closingEnd: true },
            },
            sale: {
                __args: { id: entry.sale_id },
                title: true,
            },
        });

        return {
            id: entry.id,
            saleId: entry.sale_id,
            itemId: entry.item_id,
            createdAt: entry.created_at,
            lotNumber: result.saleItem?.itemNumber ?? undefined,
            lotTitle: result.saleItem?.title ?? undefined,
            auctionTitle: result.sale?.title ?? undefined,
            image: result.saleItem?.images?.[0]?.url ?? undefined,
            currency: result.saleItem?.currency ?? null,
            currentBid: result.saleItem?.currentBid ?? null,
            startingBid: result.saleItem?.startingBid ?? null,
            lowEstimate: result.saleItem?.estimates?.low ?? null,
            highEstimate: result.saleItem?.estimates?.high ?? null,
            closingDate: result.saleItem?.dates?.closingEnd ?? null,
            status: result.saleItem?.status ?? undefined,
        };
    } catch {
        return {
            id: entry.id,
            saleId: entry.sale_id,
            itemId: entry.item_id,
            createdAt: entry.created_at,
        };
    }
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entries = await listWatchlistItems(session.user.id);
    const items = await Promise.all(entries.map(enrichWatchlistItem));
    return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { saleId?: string; itemId?: string };
    const saleId = body.saleId?.trim();
    const itemId = body.itemId?.trim();

    if (!saleId || !itemId) {
        return NextResponse.json({ error: "saleId and itemId are required" }, { status: 400 });
    }

    const entry = await addWatchlistItem({ userId: session.user.id, saleId, itemId });
    const enriched = await enrichWatchlistItem(entry);
    return NextResponse.json({ item: enriched }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { saleId?: string; itemId?: string };
    const saleId = body.saleId?.trim();
    const itemId = body.itemId?.trim();

    if (!saleId || !itemId) {
        return NextResponse.json({ error: "saleId and itemId are required" }, { status: 400 });
    }

    await removeWatchlistItem({ userId: session.user.id, saleId, itemId });
    return NextResponse.json({ success: true });
}
