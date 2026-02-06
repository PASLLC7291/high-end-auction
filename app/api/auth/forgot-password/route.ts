import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { emailExists } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
    email: z.string().email(),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Please enter a valid email address." },
                { status: 400 }
            );
        }

        const { email } = parsed.data;

        // Check if user exists (but always return success to prevent enumeration)
        const exists = await emailExists(email);
        if (exists) {
            // TODO: Send actual password reset email via your email provider.
            // For now, log that a reset was requested for a valid account.
            console.log(`Password reset requested for: ${email}`);
        }

        // Always return success to prevent email enumeration
        return NextResponse.json({
            success: true,
            message: "If an account exists for that email, you will receive reset instructions.",
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        return NextResponse.json(
            { error: "Unable to process your request right now." },
            { status: 500 }
        );
    }
}
