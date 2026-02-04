import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserBalance } from "@/lib/balance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { balanceCents, currency } = await getUserBalance({ userId: session.user.id });
        return NextResponse.json({ balanceCents, currency });
    } catch (error) {
        console.error("Balance fetch error:", error);
        return NextResponse.json(
            { error: "Unable to load balance right now." },
            { status: 503 }
        );
    }
}

