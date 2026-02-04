import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { getClientApiClient } from "@/lib/basta-client";
import { formatCurrency, translateItemStatus } from "@/lib/utils";
import { clientApiSchema } from "@bastaai/basta-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type TagItem = {
    id: string;
    saleId: string;
    lotNumber: number;
    title: string | undefined;
    lowEstimate: number | null;
    highEstimate: number | null;
    image: string | undefined;
    currentBid: number | null;
    startingBid: number | null;
    bidsCount: number | undefined;
    reserveMet: boolean | null;
    status: clientApiSchema.ItemStatus;
    saleTitle?: string | undefined;
};

async function getItemsByTag(tagName: string, bidderToken?: string): Promise<TagItem[]> {
    if (!process.env.ACCOUNT_ID) {
        console.error("Missing env variable: ACCOUNT_ID");
        return [];
    }

    const client = getClientApiClient(bidderToken);

    // Escape the tag name for Typesense filter
    const escapeTypesenseValue = (value: string): string => {
        // Escape special characters in Typesense filter values
        return value.replace(/[\\`]/g, "\\$&");
    };

    try {
        // Search for items with the specified tag
        // Tags is an array field, so use array syntax
        // Tag names need to be quoted for Typesense string arrays
        const escapedTagName = escapeTypesenseValue(tagName);
        // Filter by tag - show all items regardless of status
        // Format: tags:=["tagName"] for string arrays in Typesense
        const filterBy = `tags:=[\"${escapedTagName}\"]`;

        const searchData = await client.query({
            search: {
                __args: {
                    accountId: process.env.ACCOUNT_ID,
                    type: "ITEM",
                    query: "*",
                    filterBy,
                    orderBy: "itemNumber:asc",
                    first: 100, // Limit to 100 items
                },
                edges: {
                    node: {
                        __typename: true,
                        on_Item: {
                            id: true,
                            saleId: true,
                            itemNumber: true,
                            status: true,
                            title: true,
                            estimates: {
                                low: true,
                                high: true,
                            },
                            currentBid: true,
                            startingBid: true,
                            totalBids: true,
                            reserveMet: true,
                            images: {
                                url: true,
                            },
                        },
                    },
                },
                pageInfo: {
                    totalRecords: true,
                },
            },
        });

        // Get sale titles for each unique saleId
        const saleIds = new Set<string>();
        searchData.search?.edges?.forEach((edge) => {
            if (edge.node.__typename === "Item") {
                saleIds.add(edge.node.saleId);
            }
        });

        // Fetch sale titles
        const saleTitlesMap: Record<string, string> = {};
        await Promise.all(
            Array.from(saleIds).map(async (saleId) => {
                try {
                    const saleData = await client.query({
                        sale: {
                            __args: { id: saleId },
                            title: true,
                        },
                    });
                    if (saleData.sale?.title) {
                        saleTitlesMap[saleId] = saleData.sale.title;
                    }
                } catch (error) {
                    console.error(`Error fetching sale ${saleId}:`, error);
                }
            })
        );

        const items: TagItem[] =
            searchData.search?.edges
                ?.map((edge) => {
                    if (edge.node.__typename === "Item") {
                        const item = edge.node;
                        return {
                            id: item.id,
                            saleId: item.saleId,
                            lotNumber: item.itemNumber,
                            title: item.title ?? undefined,
                            lowEstimate: item.estimates?.low,
                            highEstimate: item.estimates?.high,
                            image: item.images?.[0]?.url,
                            currentBid: item.currentBid,
                            startingBid: item.startingBid,
                            bidsCount: item.totalBids,
                            reserveMet: item.reserveMet ?? null,
                            status: item.status,
                            saleTitle: saleTitlesMap[item.saleId],
                        } as TagItem;
                    }
                    return null;
                })
                .filter((item): item is TagItem => item !== null) || [];

        return items;
    } catch (error) {
        console.error("Error fetching items by tag:", error);
        return [];
    }
}

export default async function TagItemsPage({
    params,
}: {
    params: Promise<{ tagName: string }>;
}) {
    const { tagName } = await params;
    const decodedTagName = decodeURIComponent(tagName);

    // Get session for authenticated requests
    const session = await getServerSession(authOptions);
    const bidderToken = session?.bidderToken;

    const items = await getItemsByTag(decodedTagName, bidderToken);

    return (
        <div className="min-h-screen">
            <AuctionNav />

            {/* Header Section */}
            <section className="border-b border-border/50 bg-muted/20 py-16 md:py-24">
                <div className="container mx-auto px-4">
                    <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
                        {decodedTagName}
                    </h1>
                    <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                        Browse all items tagged with "{decodedTagName}"
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {items.length} {items.length === 1 ? "item" : "items"} found
                    </p>
                </div>
            </section>

            {/* Items Grid */}
            <section className="container mx-auto px-4 py-20 md:py-28">
                {items.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-lg text-muted-foreground">
                            No items found with the tag "{decodedTagName}"
                        </p>
                        <Link href="/">
                            <button className="mt-6 rounded-md border border-border bg-background px-6 py-2.5 text-sm font-normal transition-colors hover:bg-accent">
                                Return to Home
                            </button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                        {items.map((item) => (
                            <Link
                                key={item.id}
                                href={`/auction/${item.saleId}/lot/${item.id}`}
                            >
                                <Card className="group overflow-hidden transition-shadow hover:shadow-lg">
                                    <div className="relative aspect-4/3 overflow-hidden bg-muted">
                                        <img
                                            src={item.image || "/placeholder.svg"}
                                            alt={item.title}
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <Badge className="absolute left-4 top-4 bg-background/90 text-foreground">
                                            Lot {item.lotNumber}
                                        </Badge>
                                    </div>
                                    <CardContent className="p-4">
                                        <div className="mb-2 flex items-center justify-between">
                                            <h3 className="font-serif text-base font-semibold leading-tight text-balance">
                                                {item.title}
                                            </h3>
                                            {item.status && (
                                                <Badge variant="outline" className="ml-2 shrink-0 text-xs">
                                                    {translateItemStatus(item.status)}
                                                </Badge>
                                            )}
                                        </div>
                                        {item.saleTitle && (
                                            <p className="mb-2 text-xs text-muted-foreground">
                                                {item.saleTitle}
                                            </p>
                                        )}
                                        <div className="mt-4 border-t border-border pt-3">
                                            {item.lowEstimate !== null &&
                                                item.lowEstimate !== undefined &&
                                                item.highEstimate !== null &&
                                                item.highEstimate !== undefined &&
                                                (item.lowEstimate > 0 || item.highEstimate > 0) && (
                                                    <>
                                                        <p className="text-xs text-muted-foreground">Estimate</p>
                                                        <p className="font-semibold">
                                                            {formatCurrency(item.lowEstimate)} -{" "}
                                                            {formatCurrency(item.highEstimate)}
                                                        </p>
                                                    </>
                                                )}
                                            {item.currentBid ? (
                                                <div className="mt-1 flex items-center justify-between">
                                                    <p className="text-sm font-medium text-primary">
                                                        Current bid: {formatCurrency(item.currentBid)}
                                                    </p>
                                                    {item.bidsCount !== undefined && item.bidsCount > 0 && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {item.bidsCount} {item.bidsCount === 1 ? "bid" : "bids"}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : item.startingBid ? (
                                                <p className="mt-1 text-sm font-medium text-muted-foreground">
                                                    Starting bid: {formatCurrency(item.startingBid)}
                                                </p>
                                            ) : null}
                                            {item.reserveMet === true && (
                                                <div className="mt-2">
                                                    <Badge
                                                        variant="secondary"
                                                        className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                                    >
                                                        Reserve Met
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            <AuctionFooter />
        </div>
    );
}
