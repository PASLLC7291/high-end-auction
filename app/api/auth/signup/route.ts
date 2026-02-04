import { NextRequest, NextResponse } from "next/server";
import { createUser, emailExists } from "@/lib/user";
import { grantUserBalance } from "@/lib/balance";
import { z } from "zod";

const signupSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    name: z.string().min(1, "Name is required"),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseOptionalDate(value: string | undefined): Date | null {
    if (!value?.trim()) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const result = signupSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.errors[0].message },
                { status: 400 }
            );
        }

        const { email, password, name } = result.data;

        // Check if email already exists
        const exists = await emailExists(email);
        if (exists) {
            return NextResponse.json(
                { error: "An account with this email already exists" },
                { status: 409 }
            );
        }

        // Create the user
        const user = await createUser(email, password, name);

        // Optional: Signup bonus balance (USD). Does not block signup if it fails.
        const amountCents = Number.parseInt(process.env.SIGNUP_BONUS_AMOUNT_CENTS || "0", 10);
        const bonusStart = parseOptionalDate(process.env.SIGNUP_BONUS_START);
        const bonusEnd = parseOptionalDate(process.env.SIGNUP_BONUS_END);
        const now = new Date();

        const eligible =
            Number.isInteger(amountCents) &&
            amountCents > 0 &&
            (!bonusStart || now >= bonusStart) &&
            (!bonusEnd || now <= bonusEnd);

        if (eligible) {
            try {
                await grantUserBalance({
                    userId: user.id,
                    email: user.email,
                    name: user.name,
                    amountCents,
                    currency: "USD",
                    description: process.env.SIGNUP_BONUS_DESCRIPTION || "Signup bonus",
                    idempotencyKey: `signup_bonus_${user.id}`,
                    metadata: {
                        source: "signup_bonus",
                    },
                });
            } catch (error) {
                console.error("Signup bonus grant failed:", error);
            }
        }

        return NextResponse.json(
            {
                message: "Account created successfully",
                user: { id: user.id, email: user.email, name: user.name }
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Signup error:", error);
        return NextResponse.json(
            { error: "Failed to create account" },
            { status: 500 }
        );
    }
}
