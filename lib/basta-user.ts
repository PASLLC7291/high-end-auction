/**
 * Basta User Address Management
 *
 * Fetch and store user addresses (shipping/billing) in Basta's user system.
 * Uses raw GraphQL because the SDK types don't cover the newer user/address
 * mutations (updateUser, upsertUserAddress) or the full MailingAddress fields
 * (shippingAddress, billingAddress, addressesV2 on UserInfo).
 */

import { MANAGEMENT_API_URL, getAccountId } from "@/lib/basta-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BastaMailingAddress = {
  id: string;
  name: string;
  company: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isPrimary: boolean;
  addressType: "BILLING" | "SHIPPING";
  label?: string | null;
};

export type BastaAddressInput = {
  addressType: "BILLING" | "SHIPPING";
  isPrimary: boolean;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  name?: string;
  company?: string;
  phone?: string;
};

// ---------------------------------------------------------------------------
// Raw GraphQL helper
// ---------------------------------------------------------------------------

async function bastaGql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const accountId = getAccountId();
  const apiKey = process.env.API_KEY?.trim();
  if (!apiKey) throw new Error("Missing API_KEY env var");

  const res = await fetch(MANAGEMENT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-account-id": accountId,
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`Basta GraphQL: ${json.errors.map((e) => e.message).join(", ")}`);
  }
  return json.data as T;
}

// ---------------------------------------------------------------------------
// Fetch user shipping address from Basta
// ---------------------------------------------------------------------------

/**
 * Read-through via `updateUser` mutation.
 *
 * The `user` query's `profile` field returns null for most users. However,
 * the `updateUser` mutation returns `UserInfo` directly with populated
 * `shippingAddress` and `addressesV2`. Calling it with an empty update
 * (no addresses array) does not modify the user — it just returns current state.
 */
const READ_USER_ADDRESS_MUTATION = `
  mutation ReadUserAddress($accountId: String!, $input: UpdateUserInput!) {
    updateUser(accountId: $accountId, input: $input) {
      userId
      shippingAddress {
        id name company phone line1 line2 city state postalCode country isPrimary addressType
      }
      addressesV2 {
        id name company phone line1 line2 city state postalCode country isPrimary addressType
      }
    }
  }
`;

type ReadUserAddressResult = {
  updateUser: {
    userId: string;
    shippingAddress: BastaMailingAddress | null;
    addressesV2: BastaMailingAddress[];
  } | null;
};

export async function getBastaUserShippingAddress(
  userId: string
): Promise<BastaMailingAddress | null> {
  const accountId = getAccountId();

  const data = await bastaGql<ReadUserAddressResult>(READ_USER_ADDRESS_MUTATION, {
    accountId,
    input: {
      userId,
      idType: "IDENTITY_PROVIDER_ID",
    },
  });

  const userInfo = data.updateUser;
  if (!userInfo) return null;

  // Prefer the primary shipping address
  if (userInfo.shippingAddress?.line1) {
    return userInfo.shippingAddress;
  }

  // Fall back to addressesV2 — find the first SHIPPING type
  const shippingAddr = userInfo.addressesV2?.find(
    (a) => a.addressType === "SHIPPING"
  );
  return shippingAddr ?? null;
}

// ---------------------------------------------------------------------------
// Store shipping address on a Basta user via updateUser (upserts)
// ---------------------------------------------------------------------------

const UPSERT_ADDRESS_MUTATION = `
  mutation UpdateUser($accountId: String!, $input: UpdateUserInput!) {
    updateUser(accountId: $accountId, input: $input) {
      userId
    }
  }
`;

export async function upsertBastaUserAddress(
  userId: string,
  address: BastaAddressInput
): Promise<void> {
  const accountId = getAccountId();

  await bastaGql(UPSERT_ADDRESS_MUTATION, {
    accountId,
    input: {
      userId,
      idType: "IDENTITY_PROVIDER_ID",
      addresses: [
        {
          addressType: address.addressType,
          isPrimary: address.isPrimary,
          line1: address.line1,
          line2: address.line2 || "",
          city: address.city,
          state: address.state || "",
          postalCode: address.postalCode,
          country: address.country,
          name: address.name || "",
          company: address.company || "",
          phone: address.phone || "",
        },
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// Convert Basta MailingAddress → ShippingAddress (for CJ fulfillment)
// ---------------------------------------------------------------------------

export function bastaAddressToShipping(addr: BastaMailingAddress): {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string;
} {
  return {
    name: addr.name,
    line1: addr.line1,
    line2: addr.line2 || undefined,
    city: addr.city,
    state: addr.state,
    postal_code: addr.postalCode,
    country: addr.country,
    phone: addr.phone || undefined,
  };
}
