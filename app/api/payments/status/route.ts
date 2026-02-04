import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPaymentMethod } from "@/lib/payment-profile";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ hasPaymentMethod: false });
        }

        const hasMethod = await hasPaymentMethod(session.user.id);
        return NextResponse.json({ hasPaymentMethod: hasMethod });
    } catch (error) {
        console.error("Payment status error:", error);
        return NextResponse.json({ hasPaymentMethod: false });
    }
}
