import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getManagementApiClient, getAccountId } from "@/lib/basta-client";
import { upsertBastaUserAddress } from "@/lib/basta-user";

type RegisterBody = {
    saleId?: string;
    identifier?: string;
    phone?: string;
    shippingAddress?: {
        name?: string;
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
    };
};

export async function POST(request: NextRequest) {
    try {
        // Get authenticated session
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { error: "Unauthorized - Please log in" },
                { status: 401 }
            );
        }

        const body = (await request.json()) as RegisterBody;
        const { saleId, identifier, phone, shippingAddress } = body;

        if (!saleId) {
            return NextResponse.json(
                { error: "Sale ID is required" },
                { status: 400 }
            );
        }

        // Require shipping address fields
        if (
            !shippingAddress?.line1 ||
            !shippingAddress?.city ||
            !shippingAddress?.state ||
            !shippingAddress?.postalCode ||
            !shippingAddress?.country
        ) {
            return NextResponse.json(
                {
                    error:
                        "Shipping address is required. Please provide line1, city, state/province, postalCode, and country.",
                },
                { status: 400 }
            );
        }

        const client = getManagementApiClient();
        const accountId = getAccountId();

        // Store shipping address on the user in Basta (blocking — fail registration if this fails)
        try {
            await upsertBastaUserAddress(session.user.id, {
                addressType: "SHIPPING",
                isPrimary: true,
                line1: shippingAddress.line1,
                line2: shippingAddress.line2,
                city: shippingAddress.city,
                state: shippingAddress.state,
                postalCode: shippingAddress.postalCode,
                country: shippingAddress.country,
                name: shippingAddress.name || session.user.name || "",
                phone: phone || identifier || "",
            });
        } catch (e) {
            console.error("[register] Failed to store shipping address in Basta:", e);
            return NextResponse.json(
                { error: "Failed to store shipping address. Please try again." },
                { status: 500 }
            );
        }

        const res = await client.mutation({
            createSaleRegistration: {
                __args: {
                    accountId: accountId,
                    input: {
                        saleId: saleId,
                        userId: session.user.id,
                        type: "ONLINE",
                        identifier: identifier?.trim() ? identifier.trim() : null,
                        // For bidder-facing registration flows we auto-accept to avoid manual approval loops.
                        // If you want registrations to be reviewed first, remove this and handle PENDING states in the UI.
                        status: "ACCEPTED",
                    }
                },
                id: true,
                rejectedReason: true,
                status: true
            }
        })

        const registration = res.createSaleRegistration

        if (!registration) {
            return NextResponse.json(
                { error: "Failed to create registration" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            registration,
        });
    } catch (error) {
        console.error("Registration error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
