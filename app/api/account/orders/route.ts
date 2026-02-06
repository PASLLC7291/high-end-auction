import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDropshipLotsByWinner } from "@/lib/dropship";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/account/orders
 *
 * Returns the authenticated user's won dropship lots with sensitive
 * cost / profit fields stripped out.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lots = await getDropshipLotsByWinner(session.user.id);

  // Strip fields the buyer should never see
  const safe = lots.map(
    ({
      cj_cost_cents: _cjCost,
      cj_shipping_cents: _cjShipping,
      profit_cents: _profit,
      error_message: _err,
      ...rest
    }) => rest
  );

  return NextResponse.json({ orders: safe });
}
