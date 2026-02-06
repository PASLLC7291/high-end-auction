import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, generateId } from "@/lib/turso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email().max(320),
    phone: z.string().max(30).optional().nullable(),
    inquiryType: z.string().min(1).max(100),
    message: z.string().min(1).max(5000),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Please fill out all required fields." },
                { status: 400 }
            );
        }

        const id = generateId();
        const createdAt = new Date().toISOString();
        const payload = {
            ...parsed.data,
            userAgent: request.headers.get("user-agent"),
            referer: request.headers.get("referer"),
        };

        await db.execute({
            sql: "INSERT INTO lead_submissions (id, type, email, payload, created_at) VALUES (?, ?, ?, ?, ?)",
            args: [
                id,
                "contact",
                parsed.data.email.toLowerCase(),
                JSON.stringify(payload),
                createdAt,
            ],
        });

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error("Contact form error:", error);
        return NextResponse.json(
            { error: "Unable to send your message right now." },
            { status: 500 }
        );
    }
}
