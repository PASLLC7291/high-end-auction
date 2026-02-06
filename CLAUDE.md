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

---

# Dropship Pipeline Operating Runbook

## Pipeline Overview

This platform includes an automated dropship auction pipeline. The flow:

1. **Sources** products from CJ Dropshipping (wholesale supplier) via their REST API
2. **Lists** them as auction lots on Basta (auction platform) via GraphQL API
3. **Collects** payment from winning bidders via Stripe invoices
4. **Fulfills** orders back through CJ Dropshipping (creates order, pays from CJ balance, ships to buyer)

The entire lifecycle is tracked in a local Turso (SQLite) database in the `dropship_lots` table. Each lot moves through a status chain from SOURCED to DELIVERED, with failure branches at each step.

Pricing logic: starting bid is set at 50% of total cost (product + shipping), reserve price at 130% of total cost. Profit margin target is 30%+.

Auctions use the OVERLAPPING closing method with a 2-minute countdown extension. Sales open 1 hour after creation and close 25 hours later.

---

## Daily Routine

What to do each day to keep the pipeline healthy:

1. **Run `pnpm pipeline:status`** -- Check the full dashboard: lot counts by status, stuck lots, failed lots, and financial summary. Look for:
   - Any lots stuck in AUCTION_CLOSED, PAID, or CJ_ORDERED for more than a few hours
   - Failed lots (CJ_OUT_OF_STOCK, CJ_PRICE_CHANGED, PAYMENT_FAILED, CANCELLED) that might need attention
   - Negative profit margin or high refund rate

2. **Review CJ API quota** -- The status command prints quota at the bottom. If any endpoint is below 200 remaining calls, alert the human. Below 100 is critical.

3. **Check if new products need sourcing** -- If there are no lots in LISTED or PUBLISHED status, the storefront is empty. Either:
   - Confirm the keyword rotation has active keywords: `pnpm pipeline:keywords list`
   - Or manually source: `pnpm pipeline:source --keyword "phone stand" --max-cost 15 --publish`

4. **Review keyword rotation** -- `pnpm pipeline:keywords list` shows all keywords with their run counts, last sourced dates, and active status. Ensure there are enough active keywords to keep the daily cron fed.

---

## Pipeline Commands Reference

All commands are run via `pnpm` from the project root.

### `pnpm pipeline:source`

Sources products from CJ and creates a Basta auction sale.

| Flag | Default | Description |
|------|---------|-------------|
| `--keyword <term>` | `"wireless headphones"` | CJ search keyword |
| `--max-cost <usd>` | `50` | Maximum wholesale cost in USD |
| `--max-products <n>` | `5` | Maximum number of products to source |
| `--publish` | (off) | Publish the sale immediately after creation |

Steps performed:
1. Pre-flight: checks CJ API quota
2. Searches CJ for the keyword (fetches 2x max-products to allow for filtering)
3. For each product: gets details, checks inventory, calculates cheapest freight
4. Saves candidates to `dropship_lots` table with status SOURCED
5. Creates a Basta sale with bid increment table
6. Attaches a registration policy requiring bidders to have a shipping address
7. Creates items in the sale with images uploaded to Basta's S3
8. Updates lot status to LISTED (or PUBLISHED if `--publish` flag is set)

### `pnpm pipeline:monitor`

Polls a specific sale and auto-processes winners, fulfillment, and refunds.

| Flag | Default | Description |
|------|---------|-------------|
| `--sale-id <id>` | (required) | Basta sale ID to monitor |
| `--poll-interval <sec>` | `30` | Seconds between poll cycles |

Runs in a loop until all lots reach a terminal state (DELIVERED, SHIPPED, CJ_PAID, CANCELLED, RESERVE_NOT_MET). Each iteration:
1. Checks sale status from Basta
2. If CLOSED: polls and processes closed sales, retries fulfillments, processes refunds
3. Checks if all lots are terminal; if so, prints summary and exits

### `pnpm pipeline:run`

Runs `source` then `monitor` in sequence. Takes the same flags as `source`. This is the "watch it go" command for end-to-end runs.

### `pnpm pipeline:status`

Shows the full operational dashboard.

| Flag | Default | Description |
|------|---------|-------------|
| `--sale-id <id>` | (optional) | Show status for a specific sale only |

Without `--sale-id`: shows total lot counts by status, stuck lots, failed lots, financial summary (revenue, cost, profit, margin, refunds, delivered count), and CJ API quota report.

With `--sale-id`: shows Basta sale status, individual item statuses with winners and bids, plus local lot data.

### `pnpm pipeline:keywords`

Manages the keyword rotation for the auto-sourcing cron job.

| Subcommand | Flags | Description |
|------------|-------|-------------|
| `list` | (none) | List all sourcing keywords with stats |
| `add` | `--keyword <term>` (required), `--max-cost <usd>` (default 50), `--max-products <n>` (default 5), `--priority <n>` (default 0) | Add a new keyword to rotation |
| `remove` | `--id <id>` | Remove a keyword by ID |

The cron picks keywords in this order: never-sourced first, then oldest last_sourced_at, then highest priority, then oldest created_at.

---

## Lot Status Lifecycle

### Success Path

```
SOURCED -> LISTED -> PUBLISHED -> AUCTION_CLOSED -> PAID -> CJ_ORDERED -> CJ_PAID -> SHIPPED -> DELIVERED
```

| Status | Meaning | What triggers the transition |
|--------|---------|------------------------------|
| SOURCED | Product found on CJ, saved to DB | `insertDropshipLot()` during sourcing |
| LISTED | Basta sale item created, images uploaded | `commandSource()` after item creation |
| PUBLISHED | Basta sale is live, accepting bids | `commandSource()` with `--publish`, or auto-source cron |
| AUCTION_CLOSED | Auction ended, winner determined, reserve met | `pollAndProcessClosedSales()` processes closed Basta items |
| PAID | Stripe invoice paid by winner | Stripe webhook (`invoice.paid` event) via `dropship-hook.ts` |
| CJ_ORDERED | CJ order created with buyer's shipping address | `fulfillDropshipLot()` after inventory + price guards pass |
| CJ_PAID | CJ order paid from CJ balance | `fulfillDropshipLot()` calls `cj.payOrder()` |
| SHIPPED | CJ has shipped the order, tracking number assigned | CJ webhook (order status SHIPPED or logistics tracking update) |
| DELIVERED | Package delivered to buyer | CJ webhook (order status DELIVERED or logistics tracking confirmed) |

### Failure Branches

| Status | Meaning | Branched from |
|--------|---------|---------------|
| RESERVE_NOT_MET | Auction closed but highest bid was below reserve price | PUBLISHED (detected during `pollAndProcessClosedSales`) |
| PAYMENT_FAILED | Stripe invoice payment failed | AUCTION_CLOSED (Stripe webhook `invoice.payment_failed`) |
| CJ_OUT_OF_STOCK | CJ variant went out of stock between auction close and fulfillment | PAID (detected during `fulfillDropshipLot` inventory guard) |
| CJ_PRICE_CHANGED | CJ price increased >20% between sourcing and fulfillment | PAID (detected during `fulfillDropshipLot` price guard) |
| CANCELLED | Terminal failure state; lot is done | Any status (CJ order cancelled, refund completed, or manual cancellation) |

---

## Handling Failures

### RESERVE_NOT_MET
**Action:** None required. This is normal -- it means the auction closed but the highest bid did not meet the reserve price (130% of total cost). No payment is collected. The product can be re-sourced in a future auction.

### PAYMENT_FAILED
**Action:** Check the Stripe dashboard for the specific invoice. Common causes:
- Card declined
- Insufficient funds
- Card expired

Stripe may auto-retry depending on the retry schedule. If retries are exhausted, the buyer may need to be contacted. Check `lot.stripe_invoice_id` to find the invoice.

### CJ_OUT_OF_STOCK
**Action:** The auto-refund system should handle this. The `/api/cron/process` cron runs `processRefunds()` every 10 minutes, which finds all lots in CJ_OUT_OF_STOCK status and:
1. Refunds the Stripe invoice (or voids it if not yet paid)
2. Cancels the Basta payment order
3. Updates the lot to CANCELLED

If the refund has not fired, check the cron logs in Vercel. You can manually trigger by running the cron endpoint or calling `processRefunds()`.

### CJ_PRICE_CHANGED
**Action:** Same auto-refund flow as CJ_OUT_OF_STOCK. The lot is refunded because the CJ price increased more than 20% from the original sourced cost, which would destroy the profit margin. After refund, consider re-sourcing the product category -- the price increase might be temporary.

### CANCELLED
**Action:** This is a terminal state. Check the `error_message` field for the specific reason. Common reasons:
- Refund completed (error_message contains "Refunded" or "Invoice voided")
- CJ order was cancelled by CJ
- Item creation failed during sourcing

No further action needed unless the error_message indicates a systemic issue.

---

## When to Alert the Human

These conditions require human attention:

- **CJ API quota below 100** on any endpoint -- Risk of pipeline halt. The free tier has 1,000 lifetime calls per endpoint. Critical endpoints: `/product/query`, `/product/stock/queryByVid`, `/logistic/freightCalculate`, `/shopping/order/createOrderV2`, `/shopping/pay/payBalance`
- **Multiple fulfillment failures in a row** (>3 in a day) -- Indicates a systemic issue with CJ, shipping addresses, or balance
- **Refund rate above 20%** -- Too many lots failing post-payment; review sourcing quality
- **Negative profit margin** -- Losing money; review pricing strategy (reserve at 130% of cost may not be enough)
- **Any lot stuck for >4 hours** -- Lots in AUCTION_CLOSED, PAID, or CJ_ORDERED should progress within minutes. Stuck lots indicate a webhook or cron failure
- **Stripe webhook failures** -- Check Vercel function logs for the `/api/webhooks/stripe` endpoint
- **CJ balance insufficient for orders** -- CJ orders are paid from CJ account balance (`payType: 2`). If balance is low, orders will fail at the payment step. Use `cj.getBalance()` to check.
- **Auto-source cron failure** -- The daily 8 AM UTC cron may fail; check if there are active keywords and review the error in Vercel logs

---

## Pipeline Environment Variables

All must be set in `.env.local` (local dev) or Vercel environment settings (production). Never commit actual values.

### CJ Dropshipping
| Variable | Purpose |
|----------|---------|
| `CJ_API_KEY` | API key for CJ Dropshipping authentication. Used to obtain access tokens. |

### Basta (Auction Platform)
| Variable | Purpose |
|----------|---------|
| `ACCOUNT_ID` | Basta account ID for all management API calls |
| `API_KEY` | Basta management API key (used in `x-api-key` header) |
| `BASTA_WEBHOOK_SECRET` | Secret for verifying Basta webhook signatures |

### Stripe (Payments)
| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe server-side API key for invoices, refunds, customers |
| `STRIPE_WEBHOOK_SECRET` | Secret for verifying Stripe webhook event signatures |

### Cron / Webhooks
| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Bearer token for authenticating Vercel cron requests |

### Email (Resend)
| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | API key for Resend transactional email service. If missing, emails are logged but not sent. |
| `RESEND_FROM` | Optional sender address (default: `Placer Auctions <noreply@placerauctions.com>`) |

### Alerting
| Variable | Purpose |
|----------|---------|
| `ALERT_WEBHOOK_URL` | Webhook URL for pipeline alerts. Auto-detects Discord vs Slack format based on URL. If missing, alerts go to console only. |

### Database (Turso / LibSQL)
| Variable | Purpose |
|----------|---------|
| `TURSO_DATABASE_URL` | Turso database URL (libsql:// protocol) |
| `TURSO_AUTH_TOKEN` | Authentication token for Turso |

### Auth (NextAuth)
| Variable | Purpose |
|----------|---------|
| `NEXTAUTH_SECRET` | Secret for NextAuth session encryption |
| `NEXTAUTH_URL` | Base URL for the application (used by NextAuth) |

---

## Guardrails

- **Max products per sourcing run: 5** -- Do not exceed to conserve CJ API quota. Each product requires 3-4 API calls (search, getProduct, getInventory, calculateFreight).
- **Max wholesale cost: $50** -- Do not source items above this without explicit human approval. Higher-cost items increase financial risk on failed orders.
- **Do not publish a sale without verifying images uploaded correctly** -- If image uploads fail silently, the listing will have no photos. Check the sourcing output for "Image X: uploaded" messages.
- **Do not source more than 2x per day on the free CJ tier** -- The free tier has 1,000 lifetime calls per endpoint. Each sourcing run of 5 products uses roughly 15-20 API calls.
- **Always check quota before sourcing** -- The `pipeline:source` command does this automatically. For manual operations, run `pnpm pipeline:status` and check the CJ API Quota section.
- **1.2-second delay between CJ API calls** -- The client enforces a 1,200ms sleep between consecutive CJ requests to avoid rate limiting. Do not bypass this.
- **CJ access token lasts 15 days, refresh token 180 days** -- Tokens are persisted in `.cj-token.json` in the project root. If auth issues occur, delete this file to force re-authentication.

---

## Cron Jobs

Defined in `vercel.json`. Both require the `CRON_SECRET` Bearer token for authentication.

### `/api/cron/process` -- Every 10 minutes (`*/10 * * * *`)

The workhorse cron. Runs 5 independent steps (each step has its own try/catch so one failure does not block others):

1. **Poll closed sales** (`pollAndProcessClosedSales`) -- Fetches all CLOSED sales from Basta, finds unprocessed items with winners, creates orders/invoices. This catches any items missed by the Basta webhook.
2. **Retry failed fulfillments** (`retryFailedFulfillments`) -- Finds all PAID lots and re-attempts CJ order creation. Handles cases where the Stripe webhook fired but CJ fulfillment failed.
3. **Process refunds** (`processRefunds`) -- Finds all lots in CJ_OUT_OF_STOCK and CJ_PRICE_CHANGED status, refunds via Stripe, cancels Basta payment orders, updates lot to CANCELLED.
4. **Financial summary** -- Attaches revenue/cost/profit data to the response for monitoring.
5. **CJ quota check** -- Checks API quota and sends a critical alert if any endpoint is below 100 remaining.

Max execution time: 60 seconds.

### `/api/cron/source` -- Daily at 8 AM UTC (`0 8 * * *`)

Auto-sources the next keyword in the rotation:

1. Picks the next active keyword from `sourcing_keywords` table (oldest `last_sourced_at`, highest priority)
2. Runs the full sourcing pipeline: CJ search, inventory/freight validation, Basta sale creation, image upload, publish
3. Records the run (increments `total_runs`, updates `last_sourced_at`)
4. If sourcing fails, still marks the keyword as sourced to prevent it from blocking rotation, and sends an alert

Max execution time: 120 seconds.

---

## Pipeline Architecture

### Core Pipeline

| File | Purpose |
|------|---------|
| `scripts/orchestrate.ts` | CLI entry point. Dispatches to source, monitor, run, status, keywords subcommands. |
| `lib/pipeline.ts` | Shared pipeline operations: poll closed sales, retry fulfillments, process refunds, dashboard, quota check, auto-source. Used by both CLI and cron. |
| `lib/cj-client.ts` | CJ Dropshipping REST API client. Handles auth token management (15-day access, 180-day refresh), product search, inventory, freight, orders, payments, tracking. Base URL: `https://developers.cjdropshipping.com/api2.0/v1` |
| `lib/dropship.ts` | DB operations for `dropship_lots` table. Insert, update, query by status/sale/item/order. Defines the `DropshipLotStatus` type union. |
| `lib/dropship-fulfillment.ts` | Post-payment CJ order creation. Guards: re-checks inventory (out-of-stock aborts), re-checks price (>20% increase aborts). Creates order, pays from balance, confirms, calculates profit. |
| `lib/dropship-refund.ts` | Stripe refund + Basta order cancellation for failed lots. Handles paid invoices (refund), open/draft invoices (void), and already-cancelled invoices (skip). |
| `lib/sourcing-keywords.ts` | DB operations for `sourcing_keywords` table. Keyword rotation: get next (oldest + highest priority), mark sourced, insert, list, toggle, delete. |

### Webhook Handlers

| File | Purpose |
|------|---------|
| `app/api/webhooks/basta/route.ts` | Handles Basta auction events: item status changes and sale status changes. Verifies webhook signature. |
| `app/api/webhooks/stripe/route.ts` | Handles Stripe payment events. Routes `invoice.paid` to dropship fulfillment hook. |
| `app/api/webhooks/stripe/dropship-hook.ts` | Triggered on `invoice.paid`. Marks lot as PAID, extracts shipping address (Stripe or Basta user profile), triggers CJ fulfillment, sends payment_received email. |
| `app/api/webhooks/cj/route.ts` | Handles CJ order and logistics updates. Maps CJ statuses (SHIPPED, DELIVERED, CANCELLED) to lot statuses. Updates tracking numbers. Sends lifecycle emails (order_shipped, order_delivered). |

### Cron Endpoints

| File | Purpose |
|------|---------|
| `app/api/cron/process/route.ts` | Every 10 min: poll closed sales, retry fulfillments, process refunds, check quota. |
| `app/api/cron/source/route.ts` | Daily 8 AM UTC: auto-source next keyword in rotation. |

### Supporting Services

| File | Purpose |
|------|---------|
| `lib/alerts.ts` | Sends pipeline alerts to a webhook (Discord, Slack, or generic HTTP). Auto-detects format from URL. Never throws -- alerting failures are swallowed to avoid breaking the pipeline. |
| `lib/email.ts` | Transactional emails via Resend API. Templates: `auction_won`, `payment_received`, `order_shipped`, `order_delivered`. Never throws -- email failures are logged but do not break the pipeline. |
| `lib/order-service.ts` | Processes closed auction items into payment orders and Stripe invoices. |
| `lib/basta-user.ts` | Fetches Basta user profiles including shipping addresses. |
| `lib/db.ts` | General database operations (payment orders, processed item tracking, webhook idempotency). |
| `lib/turso.ts` | Turso/LibSQL database client and ID generation. |

### Configuration Files

| File | Purpose |
|------|---------|
| `vercel.json` | Cron job schedules. |
| `package.json` | All `pipeline:*` script definitions. |
| `.env.local` | Environment variables (not committed). |
| `.cj-token.json` | Persisted CJ API access/refresh tokens (auto-generated, not committed). |

---

## Transactional Email Templates

Emails are sent at key lifecycle points via Resend. All are fire-and-forget (failures do not break the pipeline).

| Template | Trigger | Content |
|----------|---------|---------|
| `auction_won` | Basta webhook: item closed with winner | Congratulations, payment coming soon |
| `payment_received` | Stripe webhook: invoice paid | Payment confirmed, preparing order |
| `order_shipped` | CJ webhook: order shipped / tracking assigned | Tracking number and carrier |
| `order_delivered` | CJ webhook: order delivered | Delivery confirmation, thank you |

---

## Bid Increment Table

Auctions use a tiered bid increment table (all values in cents):

| Range (cents) | Increment (cents) |
|---------------|--------------------|
| 0 -- 1,000 | 100 ($1.00) |
| 1,000 -- 5,000 | 250 ($2.50) |
| 5,000 -- 10,000 | 500 ($5.00) |
| 10,000 -- 50,000 | 1,000 ($10.00) |

---

## Quick Troubleshooting

**Lot stuck in AUCTION_CLOSED:**
The Basta webhook or cron may have failed to process it. Run `pnpm pipeline:status --sale-id <id>` to check. The `/api/cron/process` cron retries this every 10 minutes.

**Lot stuck in PAID:**
CJ fulfillment failed. Check the `error_message` on the lot. Common issues: no shipping address, CJ API error, CJ balance too low. The cron retries PAID lots every 10 minutes via `retryFailedFulfillments()`.

**Lot stuck in CJ_ORDERED:**
CJ payment step failed after order creation. The lot has a CJ order but it has not been paid. Check `error_message`. May need manual intervention via CJ dashboard.

**No products being sourced:**
Check `pnpm pipeline:keywords list`. If no active keywords exist, the daily cron skips silently. Add keywords: `pnpm pipeline:keywords add --keyword "bluetooth speaker" --max-cost 20`.

**CJ authentication errors:**
Delete `.cj-token.json` from the project root and retry. The client will re-authenticate using the API key. Access tokens last 15 days; refresh tokens last 180 days.

**Images missing on auction listings:**
Image upload can fail silently (CJ image download failure or Basta S3 PUT failure). Check the sourcing command output for "Image X: uploaded" vs warning messages. Re-source the products if images are critical.
