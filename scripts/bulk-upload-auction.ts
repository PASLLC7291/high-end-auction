import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { getManagementApiClient, getAccountId } from "../lib/basta-client";

// ============================================================================
// CONFIGURE YOUR AUCTION HERE
// ============================================================================

const AUCTION_CONFIG = {
  title: "My Auction Title",
  description: "Auction description goes here",
  currency: "USD",
  // Opening and closing dates (RFC3339 format)
  openDate: "2025-02-10T10:00:00Z",
  closingDate: "2025-02-17T20:00:00Z",
  // Set to true to publish immediately after creation
  publishAfterCreate: false,
};

// ============================================================================
// DEFINE YOUR ITEMS HERE
// All amounts are in CENTS (e.g., $100 = 10000)
// ============================================================================

interface AuctionItem {
  title: string;
  description: string;
  startingBid: number; // in cents
  reserve?: number; // in cents (optional - minimum price to sell)
  lowEstimate?: number; // in cents (optional)
  highEstimate?: number; // in cents (optional)
  imageUrls?: string[]; // URLs to images
}

const ITEMS: AuctionItem[] = [
  // Example items - replace with your actual items
  {
    title: "Item 1 - Vintage Watch",
    description: "A beautiful vintage watch from the 1960s",
    startingBid: 10000, // $100
    reserve: 50000, // $500
    lowEstimate: 30000, // $300
    highEstimate: 80000, // $800
    imageUrls: [
      // Add your image URLs here
      // "https://example.com/image1.jpg",
    ],
  },
  {
    title: "Item 2 - Antique Vase",
    description: "Ming dynasty style decorative vase",
    startingBid: 5000, // $50
    reserve: 20000, // $200
    imageUrls: [],
  },
  // Add more items below...
];

// ============================================================================
// SCRIPT EXECUTION - Don't modify below unless needed
// ============================================================================

async function uploadImages(
  client: ReturnType<typeof getManagementApiClient>,
  accountId: string,
  itemId: string,
  imageUrls: string[]
): Promise<void> {
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    try {
      await client.mutation({
        createItemImage: {
          __args: {
            accountId,
            input: {
              itemId,
              url,
              order: i + 1,
            },
          },
          id: true,
          url: true,
        },
      });
      console.log(`    ✓ Added image ${i + 1}: ${url}`);
    } catch (error) {
      console.error(`    ✗ Failed to add image: ${url}`, error);
    }
  }
}

async function main() {
  console.log("🚀 Starting bulk auction upload...\n");

  const client = getManagementApiClient();
  const accountId = getAccountId();

  // Step 1: Create the sale (auction)
  console.log("📦 Creating auction...");
  const saleResult = await client.mutation({
    createSale: {
      __args: {
        accountId,
        input: {
          title: AUCTION_CONFIG.title,
          description: AUCTION_CONFIG.description,
          currency: AUCTION_CONFIG.currency,
          closingMethod: "OVERLAPPING",
          closingTimeCountdown: 120000, // 2 minutes anti-sniping
        },
      },
      id: true,
      title: true,
      status: true,
    },
  });

  const saleId = saleResult.createSale?.id;
  if (!saleId) {
    throw new Error("Failed to create sale");
  }

  console.log(`✓ Created auction: "${AUCTION_CONFIG.title}" (ID: ${saleId})\n`);

  // Step 2: Add items to the sale
  console.log(`📝 Adding ${ITEMS.length} items...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    console.log(`[${i + 1}/${ITEMS.length}] Adding: ${item.title}`);

    try {
      const itemResult = await client.mutation({
        createItemForSale: {
          __args: {
            accountId,
            input: {
              saleId,
              title: item.title,
              description: item.description,
              startingBid: item.startingBid,
              reserve: item.reserve || 0,
              lowEstimate: item.lowEstimate,
              highEstimate: item.highEstimate,
              openDate: AUCTION_CONFIG.openDate,
              closingDate: AUCTION_CONFIG.closingDate,
              allowedBidTypes: ["MAX", "NORMAL"],
              ItemNumber: i + 1,
            },
          },
          id: true,
          title: true,
        },
      });

      const itemId = itemResult.createItemForSale?.id;
      if (!itemId) {
        throw new Error("No item ID returned");
      }

      console.log(`  ✓ Created item (ID: ${itemId})`);

      // Upload images if any
      if (item.imageUrls && item.imageUrls.length > 0) {
        await uploadImages(client, accountId, itemId, item.imageUrls);
      }

      successCount++;
    } catch (error) {
      console.error(`  ✗ Failed to add item: ${item.title}`, error);
      failCount++;
    }

    console.log("");
  }

  // Step 3: Optionally publish the sale
  if (AUCTION_CONFIG.publishAfterCreate) {
    console.log("🎯 Publishing auction...");
    try {
      await client.mutation({
        publishSale: {
          __args: {
            accountId,
            input: {
              saleId,
            },
          },
          id: true,
          status: true,
        },
      });
      console.log("✓ Auction published!\n");
    } catch (error) {
      console.error("✗ Failed to publish auction:", error);
    }
  }

  // Summary
  console.log("═══════════════════════════════════════════════════════════");
  console.log("                      UPLOAD COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Auction ID: ${saleId}`);
  console.log(`Auction Title: ${AUCTION_CONFIG.title}`);
  console.log(`Items added: ${successCount}/${ITEMS.length}`);
  if (failCount > 0) {
    console.log(`Failed items: ${failCount}`);
  }
  console.log(`Status: ${AUCTION_CONFIG.publishAfterCreate ? "PUBLISHED" : "UNPUBLISHED (draft)"}`);
  console.log("");
  console.log("View in Basta Dashboard:");
  console.log(`https://dashboard.basta.app/sales/${saleId}`);
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch(console.error);
