import { createClientApiClient, createManagementApiClient } from "@bastaai/basta-js";

// Allow overriding the domain via environment variables
// If BASTA_DOMAIN is set, use it to construct URLs; otherwise use the default domain
const getDomain = () => {
    const domain = (process.env.NEXT_PUBLIC_BASTA_DOMAIN || process.env.BASTA_DOMAIN)?.trim();
    if (domain) {
        // Remove protocol if present
        const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/^wss?:\/\//, "");
        return cleanDomain;
    }
    return "basta.app";
};

const domain = getDomain();

export const CLIENT_API_REMOTE_URL =
    process.env.BASTA_CLIENT_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASTA_CLIENT_API_URL?.trim() ||
    `https://client.api.${domain}/graphql`;
// Backwards compatible export for server-side usage.
export const CLIENT_API_URL = CLIENT_API_REMOTE_URL;
export const CLIENT_API_PROXY_URL = "/api/basta/client";
export const WS_CLIENT_API_URL =
    process.env.NEXT_PUBLIC_BASTA_WS_CLIENT_API_URL?.trim() ||
    `wss://client.api.${domain}/graphql`;
export const MANAGEMENT_API_URL =
    process.env.BASTA_MANAGEMENT_API_URL?.trim() || `https://management.api.${domain}/graphql`;

/**
 * Creates a Basta client API client for read operations and bidding
 * @param bidderToken - Optional bidder token for authenticated operations (bidding)
 */
export function getClientApiClient(
    bidderToken?: string,
    options?: { signal?: AbortSignal }
) {

    const headers = {
        ...(bidderToken ? { "Authorization": `Bearer ${bidderToken}` } : {}),
    };

    return createClientApiClient({
        url: typeof window === "undefined" ? CLIENT_API_REMOTE_URL : CLIENT_API_PROXY_URL,
        headers: headers,
        signal: options?.signal,
    });
}

/**
 * Creates a Basta management API client for server-side operations
 * Requires API_KEY and ACCOUNT_ID environment variables
 */
export function getManagementApiClient() {
    const apiKey = process.env.API_KEY?.trim();
    const accountId = process.env.ACCOUNT_ID?.trim();

    if (!apiKey || !accountId) {
        throw new Error("Missing API_KEY or ACCOUNT_ID environment variables");
    }

    return createManagementApiClient({
        url: MANAGEMENT_API_URL,
        headers: {
            "x-api-key": apiKey,
            "x-account-id": accountId,
        },
    });
}

/**
 * Get the account ID from environment
 */
export function getAccountId(): string {
    const accountId = (process.env.ACCOUNT_ID || process.env.NEXT_PUBLIC_ACCOUNT_ID)?.trim();
    if (!accountId) {
        throw new Error("Missing ACCOUNT_ID environment variable");
    }
    return accountId;
}
