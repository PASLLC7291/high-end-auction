import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isWatchlisted } from "@/lib/watchlist";

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ watchlisted: false });
    }

    const { searchParams } = new URL(request.url);
    const saleId = searchParams.get("saleId")?.trim();
    const itemId = searchParams.get("itemId")?.trim();

    if (!saleId || !itemId) {
        return NextResponse.json({ error: "saleId and itemId are required" }, { status: 400 });
    }

    const watchlisted = await isWatchlisted({ userId: session.user.id, saleId, itemId });
    return NextResponse.json({ watchlisted });
}

