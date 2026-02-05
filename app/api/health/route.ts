import { NextResponse } from "next/server";
import { db } from "@/lib/turso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute("SELECT 1 as ok");
    return NextResponse.json({ ok: true, db: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { ok: false, db: false, timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}

