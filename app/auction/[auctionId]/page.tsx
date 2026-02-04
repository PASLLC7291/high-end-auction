import { getServerSession } from "next-auth";
import ADP, { Auction } from "./ADP";
import { getClientApiClient } from "@/lib/basta-client";
import { authOptions } from "@/lib/auth";

async function getAuctionDetails(id: string, bidderToken?: string): Promise<Auction | null> {
  if (!process.env.ACCOUNT_ID) {
    console.error("Missing env variable: ACCOUNT_ID");
    return null;
  }

  const client = getClientApiClient(bidderToken);

  try {
    // Get sale details
    const { sale } = await client.query({
      sale: {
        __args: {
          id,
        },
        title: true,
        status: true,
        location: true,
        currency: true,
        externalId: true,
        images: { url: true },
        metafields: {
          nodes: {
            key: true,
            value: true,
          }
        },
        userSaleRegistrations: {
          id: true,
          registrationType: true,
          saleId: true,
          status: true,
          userId: true
        },
        dates: {
          openDate: true,
          closingDate: true,
          liveDate: true,
        },
      },
    });

    // Get items using search endpoint with facets
    const searchData = await client.query({
      search: {
        __args: {
          accountId: process.env.ACCOUNT_ID,
          type: "ITEM",
          query: "*",
          filterBy: `saleId:${id}`,
          orderBy: "itemNumber:asc",
        },
        facets: {
          fieldName: true,
          counts: {
            value: true,
            count: true,
          },
        },
        edges: {
          node: {
            __typename: true,
            on_Item: {
              id: true,
              cursor: true,
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
              dates: {
                closingEnd: true,
              },
            },
          },
        },
        pageInfo: {
          totalRecords: true,
        },
      },
    });

    const searchResult = searchData.search;
    const lots = searchResult?.edges?.map((edge) => {
      if (edge.node.__typename === "Item") {
        // Access Item fields through the inline fragment
        const lot = edge.node
        return {
          id: lot.id,
          lotNumber: lot.itemNumber,
          title: lot.title ?? undefined,
          lowEstimate: lot.estimates?.low,
          highEstimate: lot.estimates?.high,
          image: lot.images?.[0]?.url,
          currentBid: lot.currentBid,
          startingBid: lot.startingBid,
          bidsCount: lot.totalBids,
          reserveMet: lot.reserveMet ?? null,
          status: lot.status,
          closingDate: lot.dates?.closingEnd ?? null,
        };
      }
      return null;
    }).filter((lot) => lot !== null) || [];

    const auctionDetails: Auction = {
      id,
      title: sale.title ?? undefined,
      status: sale.status,
      location: sale.location ?? undefined,
      dates: {
        openDate: sale.dates.openDate ?? undefined,
        closingDate: sale.dates.closingDate ?? undefined,
      },
      lots,
      userSaleRegistrations: sale.userSaleRegistrations || [],
    };
    return auctionDetails;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function getFacets(saleId: string, bidderToken?: string) {
  if (!process.env.ACCOUNT_ID) {
    return [];
  }

  const client = getClientApiClient(bidderToken);

  try {
    const searchData = await client.query({
      search: {
        __args: {
          accountId: process.env.ACCOUNT_ID,
          type: "ITEM",
          query: "*",
          filterBy: `saleId:${saleId}`,
        },
        facets: {
          fieldName: true,
          counts: {
            value: true,
            count: true,
          },
        },
      },
    });

    const searchResult = searchData.search;
    return searchResult?.facets || [];
  } catch (error) {
    console.error("Error fetching facets:", error);
    return [];
  }
}

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  try {
    const { auctionId } = await params;

    // Get session for authenticated requests
    const session = await getServerSession(authOptions);
    const bidderToken = session?.bidderToken;

    const auctionDetails = await getAuctionDetails(auctionId, bidderToken);
    const facets = await getFacets(auctionId, bidderToken);;

    if (auctionDetails === null) return "Something went wrong";

    const accountId = process.env.ACCOUNT_ID || "";

    return <ADP auctionDetails={auctionDetails} facets={facets} accountId={accountId} />;
  } catch (error) {
    console.error(error);
    return "Something went wrong";
  }
}
