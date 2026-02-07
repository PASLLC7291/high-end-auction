/**
 * Sourcing Categories — Curated keyword list for diverse product discovery.
 *
 * Used by the smart sourcing agent to search broadly across categories,
 * ensuring category diversity in auction listings.
 */

export type SourcingCategory = {
  name: string;
  keywords: string[];
};

export const SOURCING_CATEGORIES: SourcingCategory[] = [
  {
    name: "Electronics",
    keywords: [
      "earbuds",
      "phone case",
      "LED strips",
      "bluetooth speaker",
      "smart watch",
      "USB cable",
      "charger",
    ],
  },
  {
    name: "Home",
    keywords: [
      "kitchen gadget",
      "LED lamp",
      "organizer",
      "water bottle",
    ],
  },
  {
    name: "Fashion",
    keywords: [
      "sunglasses",
      "wallet",
      "backpack",
    ],
  },
  {
    name: "Toys",
    keywords: [
      "fidget toy",
      "puzzle",
      "RC car",
    ],
  },
  {
    name: "Beauty",
    keywords: [
      "makeup brushes",
      "hair accessories",
    ],
  },
  {
    name: "Sports",
    keywords: [
      "yoga mat",
      "camping light",
      "fitness band",
    ],
  },
];

/** Flatten all keywords with their category name attached. */
export function getAllKeywordsWithCategory(): Array<{
  keyword: string;
  category: string;
}> {
  const result: Array<{ keyword: string; category: string }> = [];
  for (const cat of SOURCING_CATEGORIES) {
    for (const kw of cat.keywords) {
      result.push({ keyword: kw, category: cat.name });
    }
  }
  return result;
}
