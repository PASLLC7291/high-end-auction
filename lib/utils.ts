import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Translates item status codes to user-friendly labels
 */
/**
 * Formats a minor currency amount (e.g., cents) to major currency (e.g., dollars)
 * @param amount - Amount in minor currency units (e.g., 10000 for $100.00)
 * @param currency - Currency code (default: "USD")
 * @param showDecimals - Whether to show decimal places (default: false for whole numbers)
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = "USD",
  showDecimals: boolean = false
): string {
  if (amount === null || amount === undefined) return "";

  const majorAmount = amount / 100;

  return majorAmount.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });
}

/**
 * Converts minor currency to major currency (e.g., cents to dollars)
 */
export function toMajorCurrency(amount: number | null | undefined): number {
  if (amount === null || amount === undefined) return 0;
  return amount / 100;
}

export function translateItemStatus(status: string | undefined | null): string {
  if (!status) return "Unknown";

  const statusMap: Record<string, string> = {
    ITEM_NOT_OPEN: "Bidding Not Available",
    ITEM_OPEN: "Open for Bidding",
    ITEM_CLOSED: "Closed",
    ITEM_SOLD: "Sold",
    ITEM_WITHDRAWN: "Withdrawn",
    ITEM_PASSED: "Passed",
    ITEM_PROCESSING: "Closed",
    ITEM_CLOSING: "Closing Soon",
  };

  return (
    statusMap[status] ||
    status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  );
}
