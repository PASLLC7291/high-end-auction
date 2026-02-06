import { getAccountId, getManagementApiClient } from "@/lib/basta-client";
import { stripe } from "@/lib/stripe";
import { getPaymentProfile } from "@/lib/payment-profile";
import {
    insertPaymentOrder,
    updatePaymentOrder,
    upsertPaymentOrderItem,
    logInvoiceAttempt,
} from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AccountFee = {
    id: string;
    name: string;
    type: "PERCENTAGE" | "AMOUNT" | "NOT_SET";
    value: number;
    lowerLimit: number;
    upperLteLimit: number | null;
};

type OrderLineItem = {
    itemId: string;
    amount: number;
    description: string;
};

type FeeLineItem = {
    description: string;
    amount: number;
};

type ExistingOrder = {
    id: string;
    saleId: string;
    status: string;
    invoiceId: string | null;
    orderLineItemIds: string[];
};

type InvoiceResult =
    | { success: true; invoiceUrl: string; stripeInvoiceId: string }
    | { success: false; reason: string };

// ---------------------------------------------------------------------------
// Account Fees
// ---------------------------------------------------------------------------

let cachedAccountFees: AccountFee[] | null = null;

export async function getAccountFees(): Promise<AccountFee[]> {
    if (cachedAccountFees) return cachedAccountFees;

    const client = getManagementApiClient();
    const accountId = getAccountId();

    const response = await client.query({
        account: {
            __args: { accountId },
            paymentDetails: {
                accountFees: {
                    id: true,
                    name: true,
                    type: true,
                    value: true,
                    lowerLimit: true,
                    upperLteLimit: true,
                },
            },
        },
    });

    const fees =
        (response.account?.paymentDetails?.accountFees as AccountFee[] | undefined) ?? [];
    cachedAccountFees = fees;
    return fees;
}

export function clearAccountFeesCache() {
    cachedAccountFees = null;
}

// ---------------------------------------------------------------------------
// Fee Calculation
// ---------------------------------------------------------------------------

export function calculateFeesForAmount(
    amount: number,
    accountFees: AccountFee[]
): FeeLineItem[] {
    const fees: FeeLineItem[] = [];

    for (const fee of accountFees) {
        if (fee.type === "NOT_SET") continue;

        // Check if amount falls within the fee's range
        if (amount < fee.lowerLimit) continue;
        if (fee.upperLteLimit != null && amount > fee.upperLteLimit) continue;

        let feeAmount: number;
        if (fee.type === "PERCENTAGE") {
            // value is in basis points (e.g. 1500 = 15.00%)
            feeAmount = Math.round((amount * fee.value) / 10000);
        } else {
            // AMOUNT — fixed fee in minor currency units
            feeAmount = fee.value;
        }

        if (feeAmount > 0) {
            fees.push({ description: fee.name, amount: feeAmount });
        }
    }

    return fees;
}

// ---------------------------------------------------------------------------
// Basta Order Queries
// ---------------------------------------------------------------------------

export async function findExistingBastaOrder(
    userId: string,
    saleId: string
): Promise<ExistingOrder | null> {
    const client = getManagementApiClient();
    const accountId = getAccountId();

    // Fetch orders for this user and look for one matching the saleId
    let after: string | undefined;

    while (true) {
        const response = await client.query({
            userOrders: {
                __args: { accountId, userID: userId, first: 50, after },
                edges: {
                    node: {
                        id: true,
                        saleId: true,
                        status: true,
                        invoiceId: true,
                        orderLines: {
                            orderLineId: true,
                            item: {
                                __typename: true,
                                on_Item: { id: true },
                            },
                        },
                    },
                },
                pageInfo: {
                    hasNextPage: true,
                    endCursor: true,
                },
            },
        });

        const connection = response.userOrders;
        if (!connection?.edges?.length) return null;

        for (const edge of connection.edges) {
            const node = edge?.node;
            if (!node) continue;

            if ((node as Record<string, unknown>).saleId === saleId) {
                const orderLines = (node.orderLines ?? []) as Array<{
                    orderLineId?: string;
                    item?: { id?: string } | null;
                }>;
                return {
                    id: node.id as string,
                    saleId: saleId,
                    status: node.status as string,
                    invoiceId: (node.invoiceId as string | null) ?? null,
                    orderLineItemIds: orderLines
                        .map((ol) => ol.item?.id)
                        .filter((id): id is string => !!id),
                };
            }
        }

        const pageInfo = connection.pageInfo;
        if (!pageInfo?.hasNextPage) break;
        after = (pageInfo.endCursor as string | undefined) ?? undefined;
    }

    return null;
}

// ---------------------------------------------------------------------------
// Basta Order Creation
// ---------------------------------------------------------------------------

export async function createBastaOrder(params: {
    saleId: string;
    userId: string;
    currency: string;
    items: OrderLineItem[];
    accountFees: AccountFee[];
}): Promise<string> {
    const { saleId, userId, currency, items, accountFees } = params;
    const client = getManagementApiClient();
    const accountId = getAccountId();

    const orderLines = items.map((item) => ({
        itemId: item.itemId,
        amount: item.amount,
        description: item.description,
        fees: calculateFeesForAmount(item.amount, accountFees).map((f) => ({
            description: f.description,
            amount: f.amount,
        })),
    }));

    const orderRes = await client.mutation({
        createOrder: {
            __args: {
                accountId,
                input: {
                    saleId,
                    userId,
                    title: `Order for sale ${saleId}`,
                    currency: currency as never,
                    orderLines,
                },
            },
            id: true,
            status: true,
        },
    });

    const orderId = orderRes.createOrder?.id as string | undefined;
    if (!orderId) {
        throw new Error("Failed to create order in Basta");
    }

    await client.mutation({
        publishPaymentOrder: {
            __args: {
                accountId,
                input: { orderId },
            },
            id: true,
            status: true,
        },
    });

    // Audit log — fire-and-forget
    try {
        await insertPaymentOrder({
            basta_order_id: orderId,
            sale_id: saleId,
            user_id: userId,
            status: "OPEN",
        });
        for (const item of items) {
            await upsertPaymentOrderItem(orderId, item.itemId);
        }
    } catch (e) {
        console.warn("[audit] Failed to log order to local DB:", e);
    }

    return orderId;
}

// ---------------------------------------------------------------------------
// Add Items to Existing Order
// ---------------------------------------------------------------------------

export async function addItemsToBastaOrder(params: {
    orderId: string;
    items: OrderLineItem[];
    accountFees: AccountFee[];
    existingItemIds: string[];
}): Promise<void> {
    const { orderId, items, accountFees, existingItemIds } = params;
    const client = getManagementApiClient();
    const accountId = getAccountId();

    const existingSet = new Set(existingItemIds);

    for (const item of items) {
        if (existingSet.has(item.itemId)) {
            console.log(
                `[order] Skipping duplicate item ${item.itemId} on order ${orderId}`
            );
            continue;
        }

        const fees = calculateFeesForAmount(item.amount, accountFees);

        await client.mutation({
            createOrderLine: {
                __args: {
                    accountId,
                    input: {
                        orderId,
                        itemId: item.itemId,
                        amount: item.amount,
                        description: item.description,
                        fees: fees.map((f) => ({
                            description: f.description,
                            amount: f.amount,
                        })),
                    },
                },
                orderLineId: true,
            },
        });

        // Audit log — fire-and-forget
        try {
            await upsertPaymentOrderItem(orderId, item.itemId);
        } catch (e) {
            console.warn("[audit] Failed to log order item to local DB:", e);
        }
    }
}

// ---------------------------------------------------------------------------
// Stripe Invoice Creation (never throws)
// ---------------------------------------------------------------------------

export async function tryCreateStripeInvoice(params: {
    orderId: string;
    saleId: string;
    userId: string;
    currency: string;
    orderLines: OrderLineItem[];
    accountFees: AccountFee[];
}): Promise<InvoiceResult> {
    const { orderId, saleId, userId, currency, orderLines, accountFees } = params;

    // Log the attempt — fire-and-forget
    try {
        await logInvoiceAttempt({
            basta_order_id: orderId,
            sale_id: saleId,
            user_id: userId,
            status: "ATTEMPTING",
        });
    } catch {
        // swallow
    }

    const profile = await getPaymentProfile(userId);
    if (!profile?.stripe_customer_id || !profile.default_payment_method_id) {
        const reason = `No payment profile for user ${userId}`;
        console.warn(`[invoice] ${reason} — order ${orderId} created without invoice`);

        try {
            await logInvoiceAttempt({
                basta_order_id: orderId,
                sale_id: saleId,
                user_id: userId,
                status: "SKIPPED_NO_PAYMENT",
            });
        } catch {
            // swallow
        }

        return { success: false, reason };
    }

    try {
        const invoice = await stripe.invoices.create({
            customer: profile.stripe_customer_id,
            collection_method: "charge_automatically",
            auto_advance: true,
            automatic_tax: { enabled: true },
            default_payment_method: profile.default_payment_method_id,
            metadata: { saleId, userId, bastaOrderId: orderId },
        });

        // Add line items: hammer price + fees for each item
        for (const line of orderLines) {
            await stripe.invoiceItems.create({
                customer: profile.stripe_customer_id,
                invoice: invoice.id,
                amount: line.amount,
                currency: currency.toLowerCase(),
                description: line.description,
                metadata: { itemId: line.itemId, bastaOrderId: orderId },
            });

            // Add fee line items
            const fees = calculateFeesForAmount(line.amount, accountFees);
            for (const fee of fees) {
                await stripe.invoiceItems.create({
                    customer: profile.stripe_customer_id,
                    invoice: invoice.id,
                    amount: fee.amount,
                    currency: currency.toLowerCase(),
                    description: `${fee.description} — ${line.description}`,
                    metadata: { itemId: line.itemId, bastaOrderId: orderId, feeType: "buyer_premium" },
                });
            }
        }

        const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
        const hostedUrl = finalized.hosted_invoice_url || finalized.invoice_pdf || "";

        // Register invoice in Basta
        const client = getManagementApiClient();
        const accountId = getAccountId();
        const dueDate = new Date(
            ((finalized.due_date ?? finalized.created) as number) * 1000
        ).toISOString();

        await client.mutation({
            createInvoice: {
                __args: {
                    accountId,
                    input: {
                        orderId,
                        externalID: finalized.id,
                        url: hostedUrl,
                        dueDate,
                    },
                },
                invoiceId: true,
                url: true,
            },
        });

        // Audit log — fire-and-forget
        try {
            await updatePaymentOrder(orderId, {
                stripe_invoice_id: finalized.id,
                stripe_invoice_url: finalized.hosted_invoice_url,
                status: "INVOICE_ISSUED",
            });
            await logInvoiceAttempt({
                basta_order_id: orderId,
                sale_id: saleId,
                user_id: userId,
                status: "INVOICE_CREATED",
                stripe_invoice_id: finalized.id,
            });
        } catch {
            // swallow
        }

        return {
            success: true,
            invoiceUrl: hostedUrl,
            stripeInvoiceId: finalized.id,
        };
    } catch (error) {
        console.error(`[invoice] Failed to create Stripe invoice for order ${orderId}:`, error);

        try {
            await logInvoiceAttempt({
                basta_order_id: orderId,
                sale_id: saleId,
                user_id: userId,
                status: "FAILED",
                error: String(error),
            });
        } catch {
            // swallow
        }

        return {
            success: false,
            reason: error instanceof Error ? error.message : String(error),
        };
    }
}

// ---------------------------------------------------------------------------
// Main Entry Point — Process Closed Items
// ---------------------------------------------------------------------------

type ClosedItem = {
    itemId: string;
    leaderId: string;
    currentBid: number;
    title: string;
};

export async function processClosedItems(params: {
    saleId: string;
    items: ClosedItem[];
    currency: string;
}): Promise<void> {
    const { saleId, items, currency } = params;

    if (!items.length) return;

    // Fetch account fees once for the batch
    const accountFees = await getAccountFees();

    // Group items by winner (userId)
    const grouped = new Map<string, OrderLineItem[]>();
    for (const item of items) {
        const lines = grouped.get(item.leaderId) ?? [];
        lines.push({
            itemId: item.itemId,
            amount: item.currentBid,
            description: item.title ? `Winning bid: ${item.title}` : "Winning bid",
        });
        grouped.set(item.leaderId, lines);
    }

    for (const [userId, orderLines] of grouped.entries()) {
        try {
            // Check Basta for existing order for this user + sale
            const existingOrder = await findExistingBastaOrder(userId, saleId);

            let orderId: string;

            if (existingOrder) {
                // Already has an invoice — skip entirely
                if (existingOrder.invoiceId) {
                    console.log(
                        `[order] Order ${existingOrder.id} already invoiced for user ${userId} sale ${saleId}`
                    );
                    continue;
                }

                // Add any new items to existing order
                orderId = existingOrder.id;
                await addItemsToBastaOrder({
                    orderId,
                    items: orderLines,
                    accountFees,
                    existingItemIds: existingOrder.orderLineItemIds,
                });
            } else {
                // Create new order
                orderId = await createBastaOrder({
                    saleId,
                    userId,
                    currency,
                    items: orderLines,
                    accountFees,
                });
            }

            // Attempt to create Stripe invoice (never throws)
            const result = await tryCreateStripeInvoice({
                orderId,
                saleId,
                userId,
                currency,
                orderLines,
                accountFees,
            });

            if (result.success) {
                console.log(
                    `[invoice] Created Stripe invoice ${result.stripeInvoiceId} for user ${userId} order ${orderId}`
                );
            } else {
                console.warn(
                    `[invoice] Skipped invoice for user ${userId} order ${orderId}: ${result.reason}`
                );
            }
        } catch (error) {
            // Log and continue — one user's failure shouldn't block others
            console.error(
                `[order] Failed to process user ${userId} in sale ${saleId}:`,
                error
            );
        }
    }
}
