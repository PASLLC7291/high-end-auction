import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, generateId } from "@/lib/turso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
    email: z.string().email(),
});

function isUniqueConstraintError(error: unknown) {
    return (
        error instanceof Error &&
        /unique constraint failed/i.test(error.message)
    );
}

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

        const id = generateId();
        const payload = {
            email,
            userAgent: request.headers.get("user-agent"),
            referer: request.headers.get("referer"),
        };

        try {
            await db.execute({
                sql: "INSERT INTO lead_submissions (id, type, email, payload) VALUES (?, ?, ?, ?)",
                args: [id, "newsletter", email.toLowerCase(), JSON.stringify(payload)],
            });
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                return NextResponse.json({
                    success: true,
                    message: "You're already subscribed.",
                });
            }
            throw error;
        }

        return NextResponse.json(
            { success: true, message: "Subscribed!" },
            { status: 201 }
        );
    } catch (error) {
        console.error("Newsletter signup error:", error);
        return NextResponse.json(
            { error: "Unable to subscribe right now." },
            { status: 500 }
        );
    }
}

