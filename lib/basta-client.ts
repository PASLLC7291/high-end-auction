import { createClientApiClient, createManagementApiClient } from "@bastaai/basta-js";

// Allow overriding the domain via environment variables
// If BASTA_DOMAIN is set, use it to construct URLs; otherwise use the default domain
const getDomain = () => {
    const domain = process.env.NEXT_PUBLIC_BASTA_DOMAIN || process.env.BASTA_DOMAIN;
    if (domain) {
        // Remove protocol if present
        const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/^wss?:\/\//, "");
        return cleanDomain;
    }
    return "basta.app";
};

const domain = getDomain();

export const CLIENT_API_URL = process.env.NEXT_PUBLIC_BASTA_CLIENT_API_URL || `https://client.api.${domain}/graphql`;
export const WS_CLIENT_API_URL = process.env.NEXT_PUBLIC_BASTA_WS_CLIENT_API_URL || `wss://client.api.${domain}/graphql`;
export const MANAGEMENT_API_URL = process.env.BASTA_MANAGEMENT_API_URL || `https://management.api.${domain}/graphql`;

/**
 * Creates a Basta client API client for read operations and bidding
 * @param bidderToken - Optional bidder token for authenticated operations (bidding)
 */
export function getClientApiClient(bidderToken?: string) {

    const headers = {
        ...(bidderToken ? { "Authorization": `Bearer ${bidderToken}` } : {}),
    };

    return createClientApiClient({
        url: CLIENT_API_URL,
        headers: headers,
    });
}

/**
 * Creates a Basta management API client for server-side operations
 * Requires API_KEY and ACCOUNT_ID environment variables
 */
export function getManagementApiClient() {
    const apiKey = process.env.API_KEY;
    const accountId = process.env.ACCOUNT_ID;

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
    const accountId = process.env.ACCOUNT_ID || process.env.NEXT_PUBLIC_ACCOUNT_ID;
    if (!accountId) {
        throw new Error("Missing ACCOUNT_ID environment variable");
    }
    return accountId;
}

