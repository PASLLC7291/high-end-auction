import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getManagementApiClient, getAccountId } from "@/lib/basta-client";

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

        const client = getManagementApiClient();
        const accountId = getAccountId();

        // Create bidder token for this user
        const tokenRes = await client.mutation({
            createBidderToken: {
                __args: {
                    accountId: accountId,
                    input: {
                        metadata: {
                            userId: session.user.id,
                            ttl: 3600, // 1 hour TTL
                        }
                    }
                },
                __typename: true,
                token: true,
                expiration: true,
            },
        });

        const bidderToken = tokenRes.createBidderToken;
        if (!bidderToken?.token) {
            return NextResponse.json(
                { error: "Failed to create bidder token" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            token: bidderToken.token,
            expiration: bidderToken.expiration,
        });
    } catch (error) {
        console.error("Token creation error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
