import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listPaymentOrderItemIds, listPaymentOrdersByUser } from "@/lib/db";
import { getClientApiClient } from "@/lib/basta-client";

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
    stripeInvoiceUrl?: string | null;
    stripeInvoiceId?: string | null;
    createdAt: string;
    items: WonItemView[];
};

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

async function fetchSaleItem(client: ReturnType<typeof getClientApiClient>, saleId: string, itemId: string): Promise<WonItemView> {
    try {
        const res = await client.query({
            saleItem: {
                __args: { saleId, itemId },
                id: true,
                itemNumber: true,
                title: true,
                status: true,
                currency: true,
                currentBid: true,
                images: { url: true },
                dates: { closingEnd: true },
            },
        });

        return {
            saleId,
            itemId,
            lotNumber: res.saleItem?.itemNumber ?? undefined,
            lotTitle: res.saleItem?.title ?? undefined,
            image: res.saleItem?.images?.[0]?.url ?? undefined,
            hammerPrice: res.saleItem?.currentBid ?? null,
            currency: res.saleItem?.currency ?? null,
            itemStatus: res.saleItem?.status ?? null,
            closingDate: res.saleItem?.dates?.closingEnd ?? null,
        };
    } catch {
        return { saleId, itemId };
    }
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = getClientApiClient();
    const orders = await listPaymentOrdersByUser(session.user.id);

    const saleTitleCache = new Map<string, Promise<string | undefined>>();
    const getTitle = (saleId: string) => {
        if (!saleTitleCache.has(saleId)) {
            saleTitleCache.set(saleId, fetchSaleTitle(client, saleId));
        }
        return saleTitleCache.get(saleId)!;
    };

    const orderViews: WonOrderView[] = [];

    for (const order of orders) {
        const itemIds = await listPaymentOrderItemIds(order.basta_order_id);
        const [auctionTitle, items] = await Promise.all([
            getTitle(order.sale_id),
            Promise.all(itemIds.map((itemId) => fetchSaleItem(client, order.sale_id, itemId))),
        ]);

        orderViews.push({
            bastaOrderId: order.basta_order_id,
            saleId: order.sale_id,
            auctionTitle,
            status: order.status ?? null,
            stripeInvoiceUrl: order.stripe_invoice_url,
            stripeInvoiceId: order.stripe_invoice_id,
            createdAt: order.created_at,
            items,
        });
    }

    return NextResponse.json({ orders: orderViews });
}

