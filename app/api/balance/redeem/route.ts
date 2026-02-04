import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db, generateId } from "@/lib/turso";
import { grantUserBalance } from "@/lib/balance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
    code: z.string().min(1),
});

function parseOptionalDate(value: string | null): Date | null {
    if (!value?.trim()) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function isUniqueConstraintError(error: unknown) {
    return error instanceof Error && /unique constraint failed/i.test(error.message);
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Please enter a valid code." },
                { status: 400 }
            );
        }

        const code = parsed.data.code.trim();
        if (!code) {
            return NextResponse.json(
                { error: "Please enter a valid code." },
                { status: 400 }
            );
        }

        const promoRes = await db.execute({
            sql: `
                SELECT id, code, amount_cents, currency, description, starts_at, ends_at, max_redemptions, active
                FROM balance_promotions
                WHERE code = ? COLLATE NOCASE AND active = 1
                LIMIT 1
            `,
            args: [code],
        });

        if (promoRes.rows.length === 0) {
            return NextResponse.json(
                { error: "Code not found." },
                { status: 404 }
            );
        }

        const promo = promoRes.rows[0] as {
            id: string;
            code: string;
            amount_cents: number;
            currency: string | null;
            description: string | null;
            starts_at: string | null;
            ends_at: string | null;
            max_redemptions: number | null;
            active: number;
        };

        const amountCents = Number(promo.amount_cents);
        if (!Number.isInteger(amountCents) || amountCents <= 0) {
            return NextResponse.json(
                { error: "This code is not available." },
                { status: 400 }
            );
        }

        const now = new Date();
        const startsAt = parseOptionalDate(promo.starts_at);
        const endsAt = parseOptionalDate(promo.ends_at);
        if ((promo.starts_at && !startsAt) || (promo.ends_at && !endsAt)) {
            return NextResponse.json(
                { error: "This code is not available." },
                { status: 400 }
            );
        }
        if (startsAt && now < startsAt) {
            return NextResponse.json(
                { error: "This code is not active yet." },
                { status: 400 }
            );
        }
        if (endsAt && now > endsAt) {
            return NextResponse.json(
                { error: "This code has expired." },
                { status: 400 }
            );
        }

        const existing = await db.execute({
            sql: "SELECT id FROM balance_promotion_redemptions WHERE promotion_id = ? AND user_id = ? LIMIT 1",
            args: [promo.id, session.user.id],
        });
        if (existing.rows.length > 0) {
            return NextResponse.json(
                { error: "You’ve already redeemed this code." },
                { status: 409 }
            );
        }

        const max = promo.max_redemptions ? Number(promo.max_redemptions) : null;
        if (max && Number.isFinite(max) && max > 0) {
            const countRes = await db.execute({
                sql: "SELECT COUNT(1) AS count FROM balance_promotion_redemptions WHERE promotion_id = ?",
                args: [promo.id],
            });
            const currentCount = Number((countRes.rows[0] as { count?: number })?.count ?? 0);
            if (currentCount >= max) {
                return NextResponse.json(
                    { error: "This code is no longer available." },
                    { status: 400 }
                );
            }
        }

        const description = promo.description || `Promotion ${promo.code}`;
        const grant = await grantUserBalance({
            userId: session.user.id,
            email: session.user.email,
            name: session.user.name,
            amountCents,
            currency: (promo.currency || "USD").toUpperCase(),
            description,
            idempotencyKey: `balance_promo_${promo.id}_${session.user.id}`,
            metadata: {
                promotionId: promo.id,
                code: promo.code,
                source: "promo_code",
            },
        });

        try {
            await db.execute({
                sql: `
                    INSERT INTO balance_promotion_redemptions (
                        id, promotion_id, user_id,
                        stripe_customer_id, stripe_transaction_id,
                        amount_cents, redeemed_at
                    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                `,
                args: [
                    generateId(),
                    promo.id,
                    session.user.id,
                    grant.customerId,
                    grant.transactionId,
                    amountCents,
                ],
            });
        } catch (error) {
            if (!isUniqueConstraintError(error)) {
                throw error;
            }
        }

        const availableCents = grant.endingBalanceCents < 0 ? -grant.endingBalanceCents : 0;

        return NextResponse.json({
            success: true,
            message: "Applied to your balance.",
            balanceCents: availableCents,
            currency: grant.currency,
        });
    } catch (error) {
        console.error("Balance promo redeem error:", error);
        return NextResponse.json(
            { error: "Unable to redeem code right now." },
            { status: 500 }
        );
    }
}

