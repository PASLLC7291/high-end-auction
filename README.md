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
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

```bash
# Basta API (get from docs.basta.app)
ACCOUNT_ID="your-basta-account-id"
API_KEY="your-basta-api-key"

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
