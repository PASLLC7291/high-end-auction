import LDP from "./LDP";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClientApiClient } from "@/lib/basta-client";
import { mapItemToLot, mapSaleToSale, type Lot, type Sale } from "./lot-types";

// Create a const query to extract types from
const lotPageQuery = (auctionId: string, lotId: string, client: ReturnType<typeof getClientApiClient>) =>
  client.query({
    saleItem: {
      __args: {
        saleId: auctionId,
        itemId: lotId,
      },
      id: true,
      itemNumber: true,
      title: true,
      description: true,
      currency: true,
      estimates: {
        low: true,
        high: true,
      },
      currentBid: true,
      startingBid: true,
      nextAsks: true,
      totalBids: true,
      bidStatus: true,
      nextItem: {
        id: true,
        itemNumber: true,
        title: true,
        images: {
          url: true,
        },
      },
      prevItem: {
        id: true,
        itemNumber: true,
        title: true,
        images: {
          url: true,
        },
      },
      status: true,
      reserveMet: true,
      reserveStatus: true,
      images: { url: true },
      dates: {
        closingEnd: true,
        closingStart: true,
        openDate: true,
      },
      userBids: {
        amount: true,
        maxAmount: true,
        date: true,
        id: true,
        bidderIdentifier: true,
        bidStatus: true,
      },
      bids: {
        __args: {
          collapseSequentialUserBids: false,
        },
        amount: true,
        maxAmount: true,
        date: true,
        bidderIdentifier: true,
        bidOrigin: {
          on_Aggregator: {
            name: true,
          },
          on_PaddleBidOrigin: {
            type: true
          },
          on_OnlineBidOrigin: {
            type: true,
          },
          on_PhoneBidOrigin: {
            type: true,
          }
        },
        bidStatus: true,
        reactiveBid: true,
        saleId: true,
        itemId: true,
        id: true,
      }
    },
    sale: {
      __args: {
        id: auctionId,
      },
      id: true,
      title: true,
      userSaleRegistrations: {
        id: true,
        registrationType: true,
        saleId: true,
        status: true,
        userId: true,
      },
    },
  });

export async function getItemDetails(auctionId: string, itemId: string, bidderToken?: string): Promise<Lot | null> {
  const client = getClientApiClient(bidderToken);
  const { saleItem } = await lotPageQuery(auctionId, itemId, client);
  return mapItemToLot(saleItem);
}

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ auctionId: string; lotId: string }>;
}) {
  const { auctionId, lotId: itemId } = await params;

  // Get session for authenticated requests
  const session = await getServerSession(authOptions);
  const bidderToken = session?.bidderToken;

  // Fetch initial data server-side
  const client = getClientApiClient(bidderToken);
  const queryResult = await lotPageQuery(auctionId, itemId, client);

  const initialLotData = mapItemToLot(queryResult.saleItem);
  const initialSaleData = mapSaleToSale(queryResult.sale);

  return (
    <LDP
      initialLotData={initialLotData}
      initialSaleData={initialSaleData}
      auctionId={auctionId}
    />
  );
}