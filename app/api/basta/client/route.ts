import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CLIENT_API_REMOTE_URL } from "@/lib/basta-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const contentType = request.headers.get("content-type") ?? "application/json";

        const body = await request.text();

        const headers: Record<string, string> = {
            "content-type": contentType,
            accept: request.headers.get("accept") ?? "application/json",
        };

        // Always prefer the server-side session token over any client-provided Authorization header.
        if (session?.bidderToken) {
            headers.authorization = `Bearer ${session.bidderToken}`;
        }

        const upstream = await fetch(CLIENT_API_REMOTE_URL, {
            method: "POST",
            headers,
            body,
            cache: "no-store",
        });

        const upstreamBody = await upstream.text();

        return new NextResponse(upstreamBody, {
            status: upstream.status,
            headers: {
                "content-type":
                    upstream.headers.get("content-type") ?? "application/json",
            },
        });
    } catch (error) {
        console.error("Basta client proxy error:", error);
        return NextResponse.json(
            { error: "Upstream request failed" },
            { status: 502 }
        );
    }
}

