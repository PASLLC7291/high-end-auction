# Basta Feature Audit (Bidder Site)

Last updated: 2026-02-04

This document tracks bidder-facing features in this repo and how they map to Basta docs and expected user behavior.

## References (Basta docs)

- API Access: `https://docs.basta.app/getting-started/api-access`
- Client API (bidder tokens): `https://docs.basta.app/api-overview/client-api`
- GraphQL subscriptions (websockets): `https://docs.basta.app/api-overview/graphql-subscriptions-(websockets)`
- Webhooks: `https://docs.basta.app/api-overview/webhooks`
- Webhook signature auth: `https://docs.basta.app/api-overview/webhooks/authenticating-webhook-payloads`
- Walkthrough (create token, bid mutation): `https://docs.basta.app/walkthroughs/create-your-first-auction`

## Environment / Config

Required (core Basta integration):
- `ACCOUNT_ID`, `API_KEY` (Management API)
- `NEXT_PUBLIC_ACCOUNT_ID` (client pages that need it)

Required (payments):
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Optional but recommended:
- `BASTA_WEBHOOK_SECRET` (required to accept Basta webhooks)
- `STRIPE_WEBHOOK_SECRET` (required to accept Stripe webhooks)

## How to run verification

1) Start the app:
- `pnpm dev`

2) Run the E2E smoke test (auth/session/watchlist/settings):
- `pnpm test:e2e`

3) Run the headless payment flow check (requires dev server running):
- `node scripts/verify-payment-flow.mjs`

## Feature checklist

### Authentication

- Sign up (`/signup` → `POST /api/auth/signup`) — PASS
- Sign in (`/login` → NextAuth credentials) — PASS
- Sign out (user menu → NextAuth signOut) — PASS
- Forgot password page (`/forgot-password`) — PARTIAL (UI only; no email reset integration)

### Marketing / Lead capture (site forms)

- Newsletter signup (footer → `POST /api/marketing/newsletter`) — PASS
- Contact form (`/contact` → `POST /api/marketing/contact`) — PASS
- Services consultation form (`/services` → `POST /api/marketing/consultation`) — PASS
- Consign valuation form + uploads (`/consign` → `POST /api/marketing/valuation`) — PASS

Notes:
- Stored in `lead_submissions` + `lead_uploads` (SQLite/Turso). Upload binaries are stored in `lead_upload_files` by default (deploy-safe for serverless). Set `LEAD_UPLOAD_STORAGE="fs"` to write to `db/uploads/` instead.
- Covered by Playwright: `tests/e2e/marketing-forms.spec.ts`.

### Bidder token lifecycle (Basta)

Expected (per Basta docs):
- Bidder token created via Management API `createBidderToken`
- `ttl` is in minutes
- Token is used as `Authorization: Bearer <token>` for client API calls (bidding)

Implementation:
- Token creation and refresh: `lib/auth.ts` — PASS
- Token usage for browser-side GraphQL: proxied via `POST /api/basta/client` — PASS
- Subscriptions: `wss://client.api.basta.app/graphql` (override with `NEXT_PUBLIC_BASTA_WS_CLIENT_API_URL`) — PASS

### Payments (Stripe)

- Add card (`/account/payment`) — PASS
  - Creates setup intent: `POST /api/payments/setup-intent`
  - Confirms card in browser (Stripe Elements)
  - Stores method: `POST /api/payments/store-method`
- Payment status (`GET /api/payments/status`) — PASS
- Stripe webhook (`POST /api/webhooks/stripe`) — PARTIAL (requires `STRIPE_WEBHOOK_SECRET` + Stripe CLI/webhook config)

### Auctions / Lots (Basta Client API)

- View auctions list (`/auctions`) — PASS
- View auction details (`/auction/[auctionId]`) — PASS
- Lots filtering/sorting (client-side search) — PASS
  - Uses `search` query; browser requests go through `/api/basta/client` to avoid CORS issues in local/dev.
- View lot details (`/auction/[auctionId]/lot/[lotId]`) — PASS

### Watchlist

- Add/remove watchlist from lot page — PASS
- View watchlist (`/account/watchlist`) — PASS

### Registration to bid (Basta Management API)

- Register to bid (registration modal) — PASS
  - API: `POST /api/protected/register` → `createSaleRegistration`

### Bidding

- “Place Bid” button behavior — PASS
  - Logged out → redirects to `/login?callbackUrl=…`
  - No card on file → redirects to `/account/payment?callbackUrl=…`
  - Not registered → opens registration modal
  - Registered + token → calls `bidOnItem` mutation
- Bid submission feedback — PASS (toast on success/failure)

NOTE: Automated tests currently validate gating + token issuance, but do not place a live bid against a production sale.

### Account

- Overview (`/account`) — PASS
- My bids (`/account/bids`) — PASS
- Won items (`/account/won`) — PASS (depends on webhook-driven orders/invoices to populate real wins)
- Settings (`/account/settings`) — PASS
  - Profile update + session update
  - Preferences update
  - Password change
  - Delete account

### Webhooks (Basta)

- Endpoint: `POST /api/webhooks/basta` — PARTIAL
  - Signature verification implemented (`x-basta-signature` + `BASTA_WEBHOOK_SECRET`)
  - Currently processes `SaleStatusChanged` (sale closed → order + Stripe invoice + Basta invoice creation)
  - Not yet handling `ItemsStatusChanged` / `BidOnItem`
  - Delivery requires Basta dashboard Action Hook URLs to point at your deployed endpoint (or a tunnel like ngrok for local)
    - Optional helper: `pnpm basta:webhooks:sync -- --url https://your-site.com/api/webhooks/basta --apply`

### Headless architecture

- Auction catalog + bidding data source: Basta GraphQL (Client API + Management API) — PASS
- Local DB is only used for: users/auth, Stripe customer/payment method storage, watchlist, webhook idempotency, and marketing/lead forms — PASS
