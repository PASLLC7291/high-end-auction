import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyPassword } from "@/lib/user";
import { getManagementApiClient, getAccountId } from "@/lib/basta-client";

type BidderTokenData = {
    token: string;
    expiration: string;
};

async function createBidderToken(userId: string): Promise<BidderTokenData | null> {
    if (!userId) {
        console.error("createBidderToken: userId is required");
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
                            // Basta TTL is in minutes
                            ttl: 60, // 1 hour
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
    // Consider token expired if it expires in less than 2 minutes (synced with client-side buffer)
    const bufferMs = 2 * 60 * 1000;
    return expirationTime - now < bufferMs;
}

export const authOptions: NextAuthOptions = {
    secret: (() => {
        const secret = process.env.NEXTAUTH_SECRET?.trim();
        if (!secret && process.env.NODE_ENV === "production") {
            throw new Error("Missing NEXTAUTH_SECRET");
        }
        return secret || "development-secret-change-in-production";
    })(),
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
        async jwt({ token, user, trigger, session }) {
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

            // Allow client-side `session.update()` to refresh name/email in the JWT
            if (trigger === "update" && session?.user) {
                token.name = session.user.name ?? token.name;
                token.email = session.user.email ?? token.email;
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
                // If refresh failed but we had a non-expired token, keep the existing one
                // (don't clear it just because refresh failed)
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
