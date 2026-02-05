# Next Gen Auction Platform

A modern auction platform built with Next.js 16, Basta auction APIs, Turso database, and Stripe payments.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Turso (libSQL)
- **Auth**: NextAuth.js with email/password
- **Auctions**: Basta API + basta-js SDK
- **Payments**: Stripe
- **UI**: shadcn/ui + Tailwind CSS v4

## Getting Started

```bash
pnpm install
pnpm db:init
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

```bash
# Basta API (get from docs.basta.app)
ACCOUNT_ID="your-basta-account-id"
NEXT_PUBLIC_ACCOUNT_ID="your-basta-account-id"
API_KEY="your-basta-api-key"
BASTA_WEBHOOK_SECRET="your-basta-webhook-secret"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Turso Database (leave empty for local SQLite)
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# Stripe (get from dashboard.stripe.com)
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## Databases

- **Primary app DB**: Turso (libSQL). In local development this defaults to a file-based SQLite DB at `db/local.db`.
- **Schema**: `db/schema.sql` (created/verified via `pnpm db:init`).

### DB Commands

```bash
pnpm db:init     # Create/update tables + indexes, then verify schema
pnpm db:verify   # Verify schema only
```

`GET /api/health` can be used to verify DB connectivity in dev/prod.

If your local DB gets out of sync during development, delete `db/local.db` and re-run `pnpm db:init`.

## Deployment

- Deployment checklist: `docs/deployment.md`
- Deploy-time env verification: `pnpm env:verify`
- Netlify build command: `pnpm deploy:build` (runs env verification + DB schema verification + `pnpm build`)
- Vercel: uses `vercel-build` → `pnpm deploy:build` (no build-command override needed)

## Project Structure

```
app/                    # Next.js App Router pages
components/             # React components
  ui/                   # shadcn/ui components
lib/                    # Utilities and clients
  auth.ts               # NextAuth configuration
  basta-client.ts       # Basta API clients
  db.ts                 # Turso database client
db/                     # Database migrations and schema
basta-js/               # Basta GraphQL SDK
basta-admin-js/         # Basta Admin SDK
```

## Features

- User registration and authentication
- Browse live auctions
- Real-time bidding with WebSocket updates
- Proxy bidding (max bid) support
- Stripe payment integration

## License

Private - Placer Auctions LLC
