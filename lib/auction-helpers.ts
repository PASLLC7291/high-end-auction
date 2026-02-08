/**
 * Shared auction helpers — extracted from the 4 duplicate copies across
 * orchestrate.ts, pipeline.ts, smart-sourcing.ts, and cj-source-and-list.ts.
 */

import { getAccountId } from "@/lib/basta-client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default buyer premium rate (15%). Used by the financial pricing model. */
export const DEFAULT_BUYER_PREMIUM_RATE = 0.15;

/** Bid increment table used for all Basta sales. */
export const DEFAULT_BID_INCREMENT_RULES = [
  { lowRange: 0, highRange: 1000, step: 100 },
  { lowRange: 1000, highRange: 5000, step: 250 },
  { lowRange: 5000, highRange: 10000, step: 500 },
  { lowRange: 10000, highRange: 50000, step: 1000 },
] as const;

// ---------------------------------------------------------------------------
// Registration Policy (shipping address requirement)
// ---------------------------------------------------------------------------

/**
 * Attach a "require shipping address" registration policy to a Basta sale.
 *
 * Creates the policy via raw GraphQL (not available in basta-js SDK) then
 * attaches it to the sale. Non-blocking — failures are logged but do not throw.
 */
export async function attachShippingAddressPolicy(saleId: string): Promise<void> {
  const accountId = getAccountId();
  const apiKey = process.env.API_KEY?.trim() ?? "";
  const gqlUrl = "https://management.api.basta.app/graphql";
  const gqlHeaders = {
    "Content-Type": "application/json",
    "x-account-id": accountId,
    "x-api-key": apiKey,
  };

  try {
    const policyRes = await fetch(gqlUrl, {
      method: "POST",
      headers: gqlHeaders,
      body: JSON.stringify({
        query: `mutation ($accountId: String!, $input: CreateSaleRegistrationPolicyInput!) {
          createSaleRegistrationPolicy(accountId: $accountId, input: $input) { id code }
        }`,
        variables: {
          accountId,
          input: {
            code: "require_shipping_address",
            description: "Bidders must provide a shipping address before bidding",
            rule: 'size(user.addresses.filter(a, a.addressType == "SHIPPING")) > 0',
          },
        },
      }),
    });

    const policyData = (await policyRes.json()) as {
      data?: { createSaleRegistrationPolicy?: { id: string; code: string } };
    };
    const policyId = policyData.data?.createSaleRegistrationPolicy?.id;

    if (policyId) {
      await fetch(gqlUrl, {
        method: "POST",
        headers: gqlHeaders,
        body: JSON.stringify({
          query: `mutation ($accountId: String!, $input: AttachSaleRegistrationPoliciesInput!) {
            attachSaleRegistrationPolicies(accountId: $accountId, input: $input) { id }
          }`,
          variables: {
            accountId,
            input: { saleId, policyIds: [policyId] },
          },
        }),
      });
      console.log(`[helpers] Attached shipping address policy: ${policyId}`);
    }
  } catch (e) {
    console.warn("[helpers] Failed to attach registration policy (non-blocking):", e);
  }
}

// ---------------------------------------------------------------------------
// Image Upload
// ---------------------------------------------------------------------------

type BastaClient = {
  mutation: (input: Record<string, unknown>) => Promise<Record<string, any>>;
};

/**
 * Upload images for an auction item via Basta's signed URL flow.
 *
 * For each image URL: createUploadUrl → fetch from CJ → PUT to S3.
 * Failures are non-blocking (individual images may fail without aborting).
 */
export async function uploadItemImages(
  bastaClient: BastaClient,
  saleId: string,
  itemId: string,
  imageUrls: string[],
): Promise<number> {
  const accountId = getAccountId();
  let uploaded = 0;

  for (let j = 0; j < imageUrls.length; j++) {
    try {
      const uploadResult = await bastaClient.mutation({
        createUploadUrl: {
          __args: {
            accountId,
            input: {
              imageTypes: ["SALE_ITEM"],
              contentType: "image/jpeg",
              order: j + 1,
              saleId,
              itemId,
            },
          },
          imageId: true,
          uploadUrl: true,
          imageUrl: true,
          headers: { key: true, value: true },
        },
      });

      const uploadData = uploadResult.createUploadUrl;
      if (!uploadData?.uploadUrl) continue;

      const imgResponse = await fetch(imageUrls[j]);
      if (!imgResponse.ok) continue;
      const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

      const putHeaders: Record<string, string> = { "Content-Type": "image/jpeg" };
      for (const h of uploadData.headers ?? []) {
        if (h.key !== "Host") putHeaders[h.key] = h.value;
      }

      const putResponse = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        headers: putHeaders,
        body: imgBuffer,
      });

      if (putResponse.ok) uploaded++;
    } catch {
      // Image upload failure is non-blocking
    }
  }

  return uploaded;
}
