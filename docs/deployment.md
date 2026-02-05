# Deployment

This app is a Next.js 16 bidder site that depends on:
- Turso/libSQL (primary database)
- Basta (Management + Client GraphQL APIs)
- Stripe (payments; keep test keys until you’re ready to switch)

## 1) Create + initialize the Turso database

1. Create a Turso database and get:
   - `TURSO_DATABASE_URL` (remote URL, e.g. `libsql://...`)
   - `TURSO_AUTH_TOKEN`

2. Initialize schema against the remote DB (run locally with env vars set):

```bash
TURSO_DATABASE_URL="libsql://..." \
TURSO_AUTH_TOKEN="..." \
pnpm db:init
```

## 2) Create the Vercel project

1. In Vercel: **Add New → Project**, then import the GitHub repo.
2. Framework preset: **Next.js** (auto-detected).
3. Root directory:
   - If the repo root contains `package.json`, leave as `.` (default).
   - If this is a monorepo, select the folder that contains `package.json`.
4. Add environment variables (next section), then deploy.

## 3) Configure environment variables

Set these in your deploy platform (Netlify/Vercel/etc):

Required:
- `ACCOUNT_ID`, `NEXT_PUBLIC_ACCOUNT_ID`, `API_KEY`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- `BASTA_WEBHOOK_SECRET`

Optional:
- `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- Cloudinary overrides (`NEXT_PUBLIC_DISABLE_CLOUDINARY`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`)
- Lead uploads: `LEAD_UPLOAD_STORAGE="db"` is recommended for serverless deployments (default).
- Basta endpoint overrides (rare): `BASTA_DOMAIN`, `BASTA_CLIENT_API_URL`, `BASTA_MANAGEMENT_API_URL`, `NEXT_PUBLIC_BASTA_WS_CLIENT_API_URL`

### Vercel notes

- This repo includes a `vercel-build` script, so Vercel will run the same checks as Netlify: `env:verify` + `db:verify` + `next build`.
- Set Node.js to 20+ in Vercel (matches `package.json` engines).
- Set `NEXTAUTH_URL` to your production URL (custom domain recommended) in the **Production** environment.

## 4) Webhooks

### Basta

- Endpoint: `POST /api/webhooks/basta`
- In Basta Dashboard, point action hooks to: `https://<your-domain>/api/webhooks/basta`
- Authentication (two supported modes):
  1. **Signature verification** (if you have a Basta webhook secret): set `BASTA_WEBHOOK_SECRET="whsec_..."` and the endpoint will validate `x-basta-signature`.
  2. **Shared header token** (recommended if you don’t have a Basta signing secret): set `BASTA_WEBHOOK_SECRET` to a random value and configure action hooks to send `x-fastbid-webhook-token: <BASTA_WEBHOOK_SECRET>`.
     - Helper: `pnpm basta:webhooks:sync -- --url https://<your-domain>/api/webhooks/basta --apply` (adds/updates the header on every subscription)

### Stripe

- Endpoint: `POST /api/webhooks/stripe`
- Create a Stripe webhook endpoint for your deploy URL and copy the signing secret to `STRIPE_WEBHOOK_SECRET`.

## 5) Smoke checks

- DB connectivity: `GET /api/health`
- Build: `pnpm build`
- E2E: `pnpm test:e2e`
