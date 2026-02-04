# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Next Gen Auction Platform is a **bidder-facing** Next.js 16 auction frontend integrating with Basta's auction APIs. It uses the App Router, NextAuth for authentication, Turso for the database, Stripe for payments, and the basta-js SDK for GraphQL operations.

**Important:** This app is the public bidding interface only. All auction/sale administration (creating auctions, adding items, publishing, managing bidders) is done in the **Basta Dashboard**:
- Dashboard: https://dashboard.basta.app/
- Account ID: `68ef01b4-b445-4d04-8f52-62a1e30763a3`

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (localhost:3000)
pnpm build            # Production build
pnpm lint             # ESLint
```

### Workspace Packages

**basta-js** (GraphQL Client SDK):
```bash
cd basta-js
pnpm build            # Build with tsup
pnpm test             # Run Vitest
pnpm lint             # Biome linter
pnpm client:update    # Regenerate Client API types from schema
pnpm manage:update    # Regenerate Management API types (requires ACCOUNT_ID/API_KEY)
```

**basta-admin-js** (Admin SDK):
```bash
cd basta-admin-js
npm test              # Jest + ESLint + TypeCheck
npm run codegen       # Generate GraphQL types
```

## Environment Setup

Copy `.env.example` to `.env.local`:
```
ACCOUNT_ID="<your-basta-account-id>"
API_KEY="<your-basta-api-key>"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<your-secret>"
```

Get credentials from [docs.basta.app](https://docs.basta.app/).

## Architecture

### API Clients (`lib/basta-client.ts`)

Two client factories for Basta's GraphQL APIs:
- `getClientApiClient(bidderToken?)` - Public API for browsing/bidding (client-side)
- `getManagementApiClient()` - Admin API requiring API_KEY/ACCOUNT_ID (server-side only)

### Authentication Flow (`lib/auth.ts`, `components/providers.tsx`)

1. User logs in via NextAuth Credentials provider (mock users in `app/_mocks/users.ts`)
2. JWT callback creates a bidder token via Management API
3. Token stored in session, refreshed when expired (5-minute buffer)
4. `BastaClientProvider` fetches token client-side and passes to `BastaProvider`

### Provider Stack (`components/providers.tsx`)

```tsx
<SessionProvider>           // NextAuth
  <BastaClientProvider>     // Handles bidder token lifecycle
    <BastaProvider>         // Basta SDK context with WebSocket support
      {children}
    </BastaProvider>
  </BastaClientProvider>
</SessionProvider>
```

### Using Basta SDK

```tsx
import { useBasta, useClientApi } from "@bastaai/basta-js";

// In components:
const { clientApi } = useBasta();
const response = await clientApi?.query({
  sale: {
    __args: { id: "sale-id" },
    id: true,
    title: true,
  },
});
```

### Key Routes

- `/` - Homepage with auction listings
- `/auction/[auctionId]` - Auction detail page
- `/auction/[auctionId]/lot/[lotId]` - Lot detail with bidding
- `/api/auth/[...nextauth]` - Auth endpoints
- `/api/protected/token` - Bidder token generation

### UI Components

Built with shadcn/ui (Radix primitives) in `components/ui/`. Uses Tailwind CSS v4 with OKLCh color system.

## Workspace Structure

- `basta-js/` - GraphQL client SDK (genql-based type generation)
- `basta-admin-js/` - Admin SDK (graphql-codegen)
- `basta-ai-skill/` - Claude skill with complete API reference and Python examples
- `headless-b2b-recipe/` - B2B example implementation
- `dev-docs/` - Basta platform documentation (glossary, tutorials, webhooks)

## Basta AI Skill (`basta-ai-skill/`)

A Claude skill providing complete Basta API coverage. Key files:
- `skill/references/management_api.md` - Full Management API reference
- `skill/references/client_api.md` - Full Client API reference
- `skill/references/webhooks.md` - Webhook integration guide
- `skill/references/glossary.md` - Auction terminology
- `skill/scripts/basta_client.py` - Python client implementation
- `skill/scripts/websocket_example.py` - WebSocket subscription example

## Basta API Coverage

### Management API (Server-side, requires `x-api-key` + `x-account-id`)

**Mutations:**
- `createSale` - Create auction with title, currency, bid increment rules, closing method
- `createItem` - Create standalone reusable item (independent of sale)
- `addItemToSale` - Add existing item to sale with open/closing dates
- `createItemForSale` - Create and add item to sale in one operation
- `removeItemFromSale` - Remove item without deleting it
- `publishSale` - Make sale live
- `createBidderToken` - Generate JWT for bidders (userId + TTL)

**Queries:**
- `sale` - Get sale details with items, status, bid increment rules
- `sales` - List all sales with pagination

### Client API (Public, optional bidder token for bidding)

**Queries:**
- `sale` - Public sale info (no auth)
- `item` - Item details with current bid and user's bid status

**Mutations:**
- `bidOnItem` - Place bid (requires bidder token)
  - Input: saleId, itemId, amount (cents), bidType (MAX or NORMAL)
  - Returns: `BidPlacedSuccess` or `BidPlacedError` (check `__typename`)
  - Error codes: `BID_TOO_LOW`, `ITEM_CLOSED`, `INVALID_TOKEN`, `UNAUTHORIZED`

**Subscriptions (WebSocket):**
- `itemUpdates` - Real-time updates for specific item (currentBid, bidCount, status, myBidStatus)
- `saleUpdates` - Real-time updates for all items in a sale

### Rate Limiting (Client API)
- 400 requests per 10 seconds per IP/endpoint combination
- Returns HTTP 429 when exceeded

## Bid Types

**MaxBid (Proxy Bidding):**
- User sets maximum amount willing to pay
- Engine automatically bids incrementally up to max
- Reacts to counter-bids; winning amount may be lower than max

**NormalBid (Direct Bidding):**
- One-time bid at exact amount
- Must align with bid increment table
- Does not react to counter-bids

## Item Management Workflows

**Workflow A (Reusable Items):**
1. `createItem` → standalone item
2. `createSale`
3. `addItemToSale`
4. `publishSale`

**Workflow B (Integrated):**
1. `createSale`
2. `createItemForSale` → creates and adds in one step
3. `publishSale`

Do not mix: only use `addItemToSale` with items from `createItem`.

## Webhook Events

Three event types (POST to configured URL):
- `BidOnItem` - Bid placed (includes bidId, amount, maxAmount, bidType, reactiveBids)
- `SaleStatusChanged` - Sale status change (UNPUBLISHED → PUBLISHED → OPEN → CLOSED)
- `ItemsStatusChanged` - Item status changes (array of itemId + itemStatus)

Use `idempotencyKey` to prevent duplicate processing.

## Key Auction Concepts

- **StartingBid**: Minimum initial bid (cents), can be off-increment
- **Reserve**: Minimum price to sell; if not met, no winner declared
- **Bid Increment Table**: Rules defining minimum bid increases at price ranges (lowRange, highRange, step)
- **NextAsks**: Calculated valid bid amounts from current state + increment rules
- **ClosingTimeCountdown**: Anti-sniping duration (ms); extends when late bids arrive

## Sale/Item Lifecycle

**Sale:** `UNPUBLISHED` → `PUBLISHED` → `OPEN` → `CLOSED`

**Item:** `UNPUBLISHED` → `PUBLISHED` → `OPEN` → `CLOSING` → `CLOSED`

## Currency

All amounts in cents following ISO 4217 (e.g., $10.00 = 1000).

## Admin Management

**All auction administration is handled in the Basta Dashboard** - this app does NOT include admin UI.

**Basta Dashboard:** https://dashboard.basta.app/

Admin tasks done in dashboard:
- Create and configure auctions (sales)
- Add items/lots to auctions
- Set starting bids, reserves, bid increments
- Upload images and descriptions
- Publish auctions to make them live
- Monitor bidding activity
- Manage bidder registrations
- Close auctions and declare winners

This Next.js app handles:
- Public auction browsing
- User registration and authentication
- Bidder registration for sales
- Real-time bidding interface
- Payment method setup (Stripe)
- Webhook processing for post-auction invoicing
