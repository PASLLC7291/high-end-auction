import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyPassword } from "@/lib/user";
import { getManagementApiClient, getAccountId } from "@/lib/basta-client";
import { hasPaymentMethod } from "@/lib/payment-profile";

type BidderTokenData = {
    token: string;
    expiration: string;
};

async function createBidderToken(userId: string): Promise<BidderTokenData | null> {
    if (!userId) {
        console.error("createBidderToken: userId is required");
        return null;
    }

    const eligible = await hasPaymentMethod(userId);
    if (!eligible) {
        console.warn("Bidder token blocked: no payment method on file");
        return null;
    }

    try {
        const client = getManagementApiClient();
        const accountId = getAccountId();

        const tokenRes = await client.mutation({
            createBidderToken: {
                __args: {
                    accountId: accountId,
                    input: {
                        metadata: {
                            userId: userId,
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
        if (!bidderToken?.token || !bidderToken?.expiration) {
            console.error("Failed to create bidder token: missing token or expiration");
            return null;
        }

        return {
            token: bidderToken.token,
            expiration: bidderToken.expiration,
        };
    } catch (error) {
        console.error("Failed to create bidder token:", error);
        return null;
    }
}

function isTokenExpired(expiration: string | undefined): boolean {
    if (!expiration) return true;
    const expirationTime = new Date(expiration).getTime();
    const now = Date.now();
    // Consider token expired if it expires in less than 5 minutes
    const bufferMs = 5 * 60 * 1000;
    return expirationTime - now < bufferMs;
}

export const authOptions: NextAuthOptions = {
    secret: process.env.NEXTAUTH_SECRET || "development-secret-change-in-production",
    providers: [
        CredentialsProvider({
            name: "Email",
            credentials: {
                email: { label: "Email", type: "email", placeholder: "you@example.com" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const user = await verifyPassword(credentials.email, credentials.password);
                if (!user) {
                    return null;
                }

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user, trigger }) {
            if (user) {
                token.id = user.id;
                token.name = user.name;
                token.email = user.email;
                // Fetch bidder token on login
                const bidderTokenData = await createBidderToken(user.id);
                if (bidderTokenData) {
                    token.bidderToken = bidderTokenData.token;
                    token.bidderTokenExpiration = bidderTokenData.expiration;
                }
            }

            // Check if bidder token is expired or missing and refresh it
            const needsRefresh =
                trigger === "update" ||
                !token.bidderToken ||
                isTokenExpired(token.bidderTokenExpiration as string | undefined);

            if (needsRefresh && token.id) {
                const bidderTokenData = await createBidderToken(token.id as string);
                if (bidderTokenData) {
                    token.bidderToken = bidderTokenData.token;
                    token.bidderTokenExpiration = bidderTokenData.expiration;
                }
            }

            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id;
                session.user.name = token.name;
                session.user.email = token.email;
            }
            if (token.bidderToken) {
                session.bidderToken = token.bidderToken as string;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
};
