"use client";

import { SessionProvider, useSession } from "next-auth/react";
import type { Session } from "next-auth";
import { ReactNode, useState, useEffect, useMemo, useRef, useCallback } from "react";
import { BastaProvider } from "@bastaai/basta-js/client";
import { CLIENT_API_PROXY_URL, WS_CLIENT_API_URL } from "@/lib/basta-client";

// 2-minute buffer before expiration to ensure token is still valid during API calls
const TOKEN_EXPIRY_BUFFER_MS = 2 * 60 * 1000;

// Decode JWT expiration (exp claim is in seconds)
function isTokenExpired(token: string): boolean {
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.exp * 1000 - TOKEN_EXPIRY_BUFFER_MS < Date.now();
    } catch {
        return true;
    }
}

function BastaClientProvider({ children }: { children: ReactNode }) {
    const { status } = useSession();
    const [bidderToken, setBidderToken] = useState<string | null>(null);
    const fetchingRef = useRef(false);

    const fetchToken = useCallback(() => {
        // Deduplicate concurrent fetch requests
        if (fetchingRef.current) return;
        fetchingRef.current = true;

        fetch("/api/protected/token", { method: "POST" })
            .then((res) => res.json())
            .then((data) => {
                if (data.token) {
                    setBidderToken(data.token);
                }
            })
            .catch((err) => console.error("Failed to fetch bidder token:", err))
            .finally(() => {
                fetchingRef.current = false;
            });
    }, []);

    useEffect(() => {
        if (status !== "authenticated") {
            setBidderToken(null);
            return;
        }

        // Fetch token if we don't have one or it's expired
        if (!bidderToken || isTokenExpired(bidderToken)) {
            fetchToken();
        }
    }, [status, bidderToken, fetchToken]);

    // Memoize the clientApi config to prevent unnecessary re-renders and re-subscriptions
    const clientApiConfig = useMemo(
        () => ({
            url: CLIENT_API_PROXY_URL,
            wsUrl: WS_CLIENT_API_URL,
            headers: {
                ...(bidderToken
                    ? { Authorization: `Bearer ${bidderToken}` }
                    : {}),
            },
            wsConnectionParams: {
                // Basta requires bidder token in the websocket init payload (not as an Authorization header).
                ...(bidderToken ? { initPayload: { token: bidderToken } } : {}),
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

export function Providers({
    children,
    session,
}: {
    children: ReactNode;
    session?: Session | null;
}) {
    return (
        <SessionProvider session={session}>
            <BastaClientProvider>{children}</BastaClientProvider>
        </SessionProvider>
    );
}
