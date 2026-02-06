/**
 * Winner Notification & Order Updates
 *
 * Sends notifications to auction winners using Basta's notification system
 * and attaches shipping addresses to Basta orders.
 *
 * Uses raw GraphQL because the SDK doesn't type the notification mutations
 * (addMessageNotificationToItem, addFairWarningNotificationToItem) or the
 * updateOrder mutation with MailingAddressInput.
 */

import { MANAGEMENT_API_URL, getAccountId } from "@/lib/basta-client";
import {
  getBastaUserShippingAddress,
  type BastaMailingAddress,
} from "@/lib/basta-user";

// ---------------------------------------------------------------------------
// Raw GraphQL helper
// ---------------------------------------------------------------------------

async function bastaGql<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
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

  const json = (await res.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };
  if (json.errors?.length) {
    throw new Error(
      `Basta GraphQL: ${json.errors.map((e) => e.message).join(", ")}`
    );
  }
  return json.data as T;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotifyWinnerParams = {
  saleId: string;
  itemId: string;
  itemTitle: string;
  /** Winning bid amount in cents */
  winningBid: number;
  /** ISO 4217 currency code, e.g. "USD" */
  currency: string;
};

type AttachShippingParams = {
  orderId: string;
  userId: string;
};

type NotifyAndUpdateOrderParams = NotifyWinnerParams & AttachShippingParams;

type MailingAddressInput = {
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

// ---------------------------------------------------------------------------
// GraphQL mutations
// ---------------------------------------------------------------------------

const ADD_MESSAGE_NOTIFICATION_MUTATION = `
  mutation AddMessageNotification($accountId: String!, $input: AddMessageNotificationToItemInput!) {
    addMessageNotificationToItem(accountId: $accountId, input: $input) {
      id
      title
    }
  }
`;

const UPDATE_ORDER_MUTATION = `
  mutation UpdateOrder($accountId: String!, $input: UpdateOrderInput!) {
    updateOrder(accountId: $accountId, input: $input) {
      id
      status
    }
  }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a cent amount into a human-readable currency string.
 * e.g. 12350, "USD" => "$123.50"
 */
function formatCurrency(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    // Fallback if the currency code is unsupported
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Map a BastaMailingAddress to the MailingAddressInput shape expected by
 * the updateOrder mutation.
 */
function toMailingAddressInput(
  addr: BastaMailingAddress
): MailingAddressInput {
  return {
    name: addr.name,
    company: addr.company,
    phone: addr.phone,
    line1: addr.line1,
    line2: addr.line2 || "",
    city: addr.city,
    state: addr.state,
    postalCode: addr.postalCode,
    country: addr.country,
    isPrimary: addr.isPrimary,
    addressType: "SHIPPING",
    label: addr.label ?? null,
  };
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Send a congratulations notification message to the winning bidder on a
 * closed auction item.
 *
 * Uses the `addMessageNotificationToItem` mutation.
 */
export async function notifyWinner(params: NotifyWinnerParams): Promise<void> {
  const { saleId, itemId, itemTitle, winningBid, currency } = params;
  const accountId = getAccountId();
  const formattedBid = formatCurrency(winningBid, currency);

  const message = `Congratulations! You won ${itemTitle} with a bid of ${formattedBid}`;

  await bastaGql(ADD_MESSAGE_NOTIFICATION_MUTATION, {
    accountId,
    input: {
      itemId,
      saleId,
      message,
    },
  });
}

/**
 * Fetch the winner's shipping address from Basta's user system and attach
 * it to their order via the `updateOrder` mutation.
 *
 * The Country enum in Basta uses ISO 3166-1 alpha-2 codes (e.g. US, GB).
 */
export async function attachShippingAddressToOrder(
  params: AttachShippingParams
): Promise<void> {
  const { orderId, userId } = params;
  const accountId = getAccountId();

  const shippingAddress = await getBastaUserShippingAddress(userId);
  if (!shippingAddress) {
    throw new Error(
      `No shipping address found for user ${userId}. Cannot update order ${orderId}.`
    );
  }

  const shippingInput = toMailingAddressInput(shippingAddress);

  await bastaGql(UPDATE_ORDER_MUTATION, {
    accountId,
    input: {
      id: orderId,
      shippingAddress: shippingInput,
    },
  });
}

/**
 * Combined convenience function: notify the winner AND attach their shipping
 * address to the order.
 *
 * Non-blocking -- failures are logged to the console but do **not** throw,
 * so callers can fire-and-forget without risking unhandled rejections.
 */
export async function notifyAndUpdateOrder(
  params: NotifyAndUpdateOrderParams
): Promise<void> {
  const {
    saleId,
    itemId,
    itemTitle,
    winningBid,
    currency,
    orderId,
    userId,
  } = params;

  const results = await Promise.allSettled([
    notifyWinner({ saleId, itemId, itemTitle, winningBid, currency }),
    attachShippingAddressToOrder({ orderId, userId }),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error(
        "[winner-notification] Non-blocking failure:",
        result.reason
      );
    }
  }
}
