"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { ReactNode, useState, useEffect, useMemo } from "react";
import { BastaProvider } from "@bastaai/basta-js/client";
import { CLIENT_API_URL, WS_CLIENT_API_URL } from "@/lib/basta-client";

// Decode JWT expiration (exp claim is in seconds)
function isTokenExpired(token: string): boolean {
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.exp * 1000 < Date.now();
    } catch {
        return true;
    }
}

function BastaClientProvider({ children }: { children: ReactNode }) {
    const { status } = useSession();
    const [bidderToken, setBidderToken] = useState<string | null>(null);

    useEffect(() => {
        if (status !== "authenticated") {
            setBidderToken(null);
            return;
        }

        // Fetch token if we don't have one or it's expired
        if (!bidderToken || isTokenExpired(bidderToken)) {
            fetch("/api/protected/token", { method: "POST" })
                .then((res) => res.json())
                .then((data) => {
                    if (data.token) {
                        setBidderToken(data.token);
                    }
                })
                .catch((err) => console.error("Failed to fetch bidder token:", err));
        }
    }, [status, bidderToken]);

    // Memoize the clientApi config to prevent unnecessary re-renders and re-subscriptions
    const clientApiConfig = useMemo(
        () => ({
            url: CLIENT_API_URL,
            wsUrl: WS_CLIENT_API_URL,
            headers: {
                ...(bidderToken
                    ? { Authorization: `Bearer ${bidderToken}` }
                    : {}),
            },
            wsConnectionParams: {
                token: bidderToken,
            },
        }),
        [bidderToken]
    );

    return (
        <BastaProvider clientApi={clientApiConfig}>
            {children}
        </BastaProvider>
    );
}

export function Providers({ children }: { children: ReactNode }) {
    return (
        <SessionProvider>
            <BastaClientProvider>{children}</BastaClientProvider>
        </SessionProvider>
    );
}

