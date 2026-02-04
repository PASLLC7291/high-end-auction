// Shared types and mappers for lot detail page
// This file is safe to import from both server and client components

import type { clientApiSchema } from "@bastaai/basta-js";
import type { SaleRegistration } from "@/components/registration-modal";

export type Bid = {
  id: string;
  amount: number;
  maxAmount?: number | null;
  bidder: string;
  date: string;
  bidStatus?: string;
};

export type UserBid = {
  bidId: string;
  amount: number;
  maxAmount?: number | null;
  date: string;
  bidType?: string;
  bidStatus?: string;
};

export type Lot = {
  id: string;
  lotNumber: number;
  title: string | undefined;
  description?: string;
  currency: string | null;
  status: clientApiSchema.ItemStatus;
  lowEstimate: number | null;
  highEstimate: number | null;
  reserveStatus: string | null;
  currentBid: number | null;
  startingBid: number | null;
  bidsCount: number | undefined;
  nextAsks: number[];
  images: string[];
  closingDate: string | null;
  openDate: string | null;
  closingStart: string | null;
  reserveMet?: boolean | null;
  bids?: Bid[];
  userBids?: UserBid[];
  prevItem?: {
    id: string;
    title?: string;
    image?: string;
  } | null;
  nextItem?: {
    id: string;
    title?: string;
    image?: string;
  } | null;
};

export type Sale = {
  id: string;
  title: string;
  userSaleRegistrations: SaleRegistration[];
};

// Type for the GraphQL response item - matches what the API returns
export type SaleItemData = {
  id: string;
  itemNumber: number;
  title?: string | null;
  description?: string | null;
  currency?: string | null;
  estimates?: {
    low?: number | null;
    high?: number | null;
  } | null;
  currentBid?: number | null;
  startingBid?: number | null;
  nextAsks?: number[] | null;
  totalBids?: number | null;
  status: clientApiSchema.ItemStatus;
  reserveMet?: boolean | null;
  reserveStatus?: string | null;
  images?: Array<{ url?: string | null }> | null;
  dates?: {
    closingEnd?: string | null;
    closingStart?: string | null;
    openDate?: string | null;
  } | null;
  userBids?: Array<{
    id: string;
    amount: number;
    maxAmount?: number | null;
    date: string;
    bidderIdentifier?: string | null;
    bidStatus?: string | null;
  }> | null;
  bids?: Array<{
    id: string;
    amount: number;
    maxAmount?: number | null;
    date: string;
    bidderIdentifier?: string | null;
    bidStatus?: string | null;
  }> | null;
  prevItem?: {
    id: string;
    title?: string | null;
    images?: Array<{ url?: string | null }> | null;
  } | null;
  nextItem?: {
    id: string;
    title?: string | null;
    images?: Array<{ url?: string | null }> | null;
  } | null;
};

export type SaleData = {
  id: string;
  title?: string | null;
  userSaleRegistrations?: SaleRegistration[] | null;
};

export const mapItemToLot = (item: SaleItemData): Lot => {
  return {
    id: item.id,
    lotNumber: item.itemNumber,
    title: item.title ?? undefined,
    description: item.description ?? undefined,
    currency: item.currency ?? "USD",
    lowEstimate: item.estimates?.low ?? 0,
    highEstimate: item.estimates?.high ?? 0,
    currentBid: item.currentBid ?? 0,
    startingBid: item.startingBid ?? 0,
    status: item.status,
    bidsCount: item.totalBids ?? undefined,
    nextAsks: item.nextAsks ?? [],
    images: item.images?.map((img) => img.url).filter((url): url is string => url != null) ?? [],
    closingDate: item.dates?.closingEnd ?? null,
    openDate: item.dates?.openDate ?? null,
    closingStart: item.dates?.closingStart ?? null,
    reserveMet: item.reserveMet ?? null,
    reserveStatus: item.reserveStatus ?? null,
    bids: item.bids?.map((bid) => ({
      id: bid.id,
      amount: bid.amount,
      maxAmount: bid.maxAmount ?? undefined,
      bidder: bid.bidderIdentifier ?? "Anonymous",
      date: bid.date,
      bidStatus: bid.bidStatus ?? undefined,
    })) ?? [],
    userBids: item.userBids?.map((bid) => ({
      bidId: bid.id,
      amount: bid.amount,
      maxAmount: bid.maxAmount ?? undefined,
      date: bid.date,
      bidType: (bid.maxAmount ?? 0) > 0 ? "MAX" : "NORMAL",
      bidStatus: bid.bidStatus ?? undefined,
    })) ?? [],
    prevItem: item.prevItem ? {
      id: item.prevItem.id,
      title: item.prevItem.title ?? undefined,
      image: item.prevItem.images?.[0]?.url ?? undefined,
    } : null,
    nextItem: item.nextItem ? {
      id: item.nextItem.id,
      title: item.nextItem.title ?? undefined,
      image: item.nextItem.images?.[0]?.url ?? undefined,
    } : null,
  };
};

export const mapSaleToSale = (sale: SaleData): Sale => {
  return {
    id: sale.id,
    title: sale.title ?? "Auction",
    userSaleRegistrations: sale.userSaleRegistrations ?? [],
  };
};
