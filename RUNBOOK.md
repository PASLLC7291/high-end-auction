# Dropship Auction Pipeline -- Operator Runbook

Last updated: 2026-02-06

---

## 1. Daily Checklist

Run these in order every morning. Total time: ~5 minutes.

| # | Task | Command | What to look for |
|---|------|---------|------------------|
| 1 | Check pipeline dashboard | `pnpm pipeline:status` | Stuck lots, failed lots, negative margin |
| 2 | Check CJ API quota | (printed at bottom of status output) | Any endpoint below 200 = warning, below 100 = critical |
| 3 | Check storefront inventory | Look for lots in LISTED or PUBLISHED status | If zero, storefront is empty -- source more products (standard or smart sourcing) |
| 4 | Check keyword rotation | `pnpm pipeline:keywords list` | Enough active keywords? Any never-sourced? |
| 5 | Check Vercel cron logs | Vercel dashboard > Functions tab | Errors in `/api/cron/process` or `/api/cron/source` |
| 6 | Spot-check Stripe | Stripe dashboard > Invoices | Any stuck or failed invoices |

---

## 2. Common Issues and Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Lot stuck in AUCTION_CLOSED for >1 hour | Basta webhook or cron failed to process | Wait for next cron cycle (every 10 min). Run `pnpm pipeline:status --sale-id <id>` to inspect. |
| Lot stuck in PAID for >1 hour | CJ fulfillment failed (no address, API error, low balance) | Check `error_message` on the lot. Cron retries every 10 min. Check CJ account balance. |
| Lot stuck in CJ_ORDERED for >4 hours | CJ payment step failed after order creation | Check `error_message`. May need manual payment via CJ dashboard. **Escalate if >8 hours.** |
| PAYMENT_FAILED status | Buyer's card declined / expired / insufficient funds | Check Stripe dashboard for the invoice. Stripe auto-retries. Contact buyer if retries exhausted. |
| CJ_OUT_OF_STOCK status | Product went out of stock after auction closed | Auto-refund runs every 10 min via cron. Verify refund processed. No action needed. |
| CJ_PRICE_CHANGED status | CJ raised price >20% since sourcing | Auto-refund runs every 10 min via cron. Consider re-sourcing the category later. |
| No products being sourced by daily cron | No active keywords in rotation | `pnpm pipeline:keywords list` -- add keywords if empty. |
| CJ authentication errors | Expired or corrupted token file | Delete `.cj-token.json` from project root and retry. |
| Images missing on listings | Silent upload failure during sourcing | Re-source the products. Check sourcing output for "Image X: uploaded" messages. |
| Emails not sending | `RESEND_API_KEY` missing or invalid | Check env var. Emails are non-blocking -- pipeline continues without them. |
| Alerts not firing | `ALERT_WEBHOOK_URL` missing or invalid | Check env var. Alerts fall back to console only. |
| RESERVE_NOT_MET status | Highest bid did not meet reserve (computed by financial model) | Normal. No action needed. Product can be re-sourced in a future auction. |

---

## 3. Pipeline Commands Quick Reference

All commands run from the project root with `pnpm`.

### Status and Monitoring

```bash
pnpm pipeline:status                          # Full dashboard: lots, financials, quota
pnpm pipeline:status --sale-id <id>           # Status for one specific sale
pnpm pipeline:keywords list                   # Show keyword rotation
```

### Standard Sourcing (small batch, single keyword)

```bash
pnpm pipeline:source --keyword "phone stand" --max-cost 15 --publish    # Source and publish
pnpm pipeline:source --keyword "bluetooth speaker" --max-products 3      # Source only (no publish)
```

| Flag | Default | Notes |
|------|---------|-------|
| `--keyword <term>` | `"wireless headphones"` | CJ search term |
| `--max-cost <usd>` | `50` | Max wholesale cost. Do not exceed $50 without approval. |
| `--max-products <n>` | `5` | Max 5 per run to conserve API quota. |
| `--publish` | off | Publishes the sale immediately. |

### Smart Sourcing (bulk auctions, multi-category)

```bash
pnpm pipeline:smart-source --dry-run                                     # Score products, don't create auctions
pnpm pipeline:smart-source --publish                                     # Full run, create and publish auctions
pnpm pipeline:smart-source --resume <run-id> --publish                   # Resume interrupted run
pnpm pipeline:smart-source --num-auctions 3 --items-per-auction 300      # Custom settings
```

| Flag | Default | Notes |
|------|---------|-------|
| `--publish` | off | Publish auctions after creation |
| `--dry-run` | off | Score products only, print analysis, don't create auctions |
| `--resume <run-id>` | (none) | Resume an interrupted run by ID |
| `--num-auctions <n>` | `3` | Number of auctions to create |
| `--items-per-auction <n>` | `300` | Target items per auction |
| `--max-detail <n>` | `500` | Max products to evaluate in Phase 2 |
| `--buyer-premium <rate>` | `0.15` | Buyer premium rate (0.15 = 15%) |

**Important:** Always `--dry-run` first to verify scoring distribution. Uses ~1,610 CJ API calls total. Progress checkpoints saved to `data/smart-source-runs/`.

### Keyword Management

```bash
pnpm pipeline:keywords list                                                    # List all
pnpm pipeline:keywords add --keyword "usb hub" --max-cost 20 --priority 1      # Add new
pnpm pipeline:keywords remove --id <id>                                        # Remove
```

### Monitoring a Live Sale

```bash
pnpm pipeline:monitor --sale-id <id>                    # Poll every 30s until all lots terminal
pnpm pipeline:monitor --sale-id <id> --poll-interval 60 # Poll every 60s
```

### End-to-End Run

```bash
pnpm pipeline:run --keyword "wireless earbuds" --max-cost 25 --publish   # Source + monitor
```

---

## 4. Environment Variables

All set in `.env.local` (local) or Vercel settings (production). Never commit actual values.

| Variable | Service | Purpose |
|----------|---------|---------|
| `CJ_API_KEY` | CJ Dropshipping | API authentication. Used to obtain access tokens. |
| `ACCOUNT_ID` | Basta | Account ID for management API calls |
| `API_KEY` | Basta | Management API key (`x-api-key` header) |
| `BASTA_WEBHOOK_SECRET` | Basta | Verifies webhook signatures |
| `STRIPE_SECRET_KEY` | Stripe | Server-side API key for invoices/refunds |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Verifies webhook event signatures |
| `CRON_SECRET` | Vercel | Bearer token for cron job authentication |
| `RESEND_API_KEY` | Resend | Transactional email. If missing, emails logged only. |
| `RESEND_FROM` | Resend | Sender address. Default: `Placer Auctions <noreply@placerauctions.com>` |
| `ALERT_WEBHOOK_URL` | Discord/Slack | Pipeline alerts. Auto-detects format. If missing, console only. |
| `TURSO_DATABASE_URL` | Turso | Database URL (`libsql://` protocol) |
| `TURSO_AUTH_TOKEN` | Turso | Database auth token |
| `NEXTAUTH_SECRET` | NextAuth | Session encryption secret |
| `NEXTAUTH_URL` | NextAuth | App base URL |

---

## 5. Alert Response Guide

Alerts arrive via the configured webhook (Discord/Slack) or console.

| Alert | Severity | What to Do |
|-------|----------|------------|
| CJ API quota below 200 | WARNING | Reduce sourcing frequency. Do not run manual sourcing. |
| CJ API quota below 100 | CRITICAL | **Stop all sourcing immediately.** Pipeline will halt if quota hits zero. Escalate to developer to upgrade CJ tier or obtain new API key. |
| Multiple fulfillment failures (>3/day) | HIGH | Check CJ dashboard for systemic issues. Verify shipping addresses are valid. Check CJ account balance. |
| Refund rate above 20% | HIGH | Review sourcing quality. Products may be unreliable. Pause sourcing for affected categories. |
| Negative profit margin | HIGH | Review pricing model parameters in `lib/auction-pricing.ts` (safety margin, CJ fluctuation buffer). The financial model guarantees profit — negative margin indicates a bug or misconfigured parameter. Escalate. |
| Lot stuck >4 hours | MEDIUM | Identify which status. Check `error_message`. See "Common Issues" table above. |
| Stripe webhook failures | HIGH | Check Vercel function logs for `/api/webhooks/stripe`. Verify `STRIPE_WEBHOOK_SECRET` is correct. |
| CJ balance insufficient | CRITICAL | **Orders will fail at payment step.** Top up CJ account balance immediately. |
| Auto-source cron failure | MEDIUM | Check Vercel logs. Verify active keywords exist. Check CJ quota. |

---

## 6. Escalation Criteria

**Call a developer when:**

- CJ API quota drops below 100 on any endpoint (pipeline will halt)
- A lot is stuck in CJ_ORDERED for more than 8 hours (needs manual CJ dashboard intervention)
- Profit margin is negative for more than 24 hours (the pricing model should guarantee profit — negative margin indicates a bug)
- More than 3 fulfillment failures in a single day
- Stripe webhooks are consistently failing (check Vercel logs)
- Cron jobs (`/api/cron/process` or `/api/cron/source`) have not run for >30 minutes
- Database (Turso) connection errors appear in logs
- CJ authentication fails even after deleting `.cj-token.json`
- Any error you do not recognize or cannot resolve within 15 minutes

**Do NOT escalate for:**

- RESERVE_NOT_MET lots (normal -- no bidder met the reserve)
- Single PAYMENT_FAILED (Stripe retries automatically)
- Single CJ_OUT_OF_STOCK or CJ_PRICE_CHANGED (auto-refund handles it)
- Emails not sending (non-blocking, check `RESEND_API_KEY` first)

---

## 7. Key URLs and Dashboards

| Dashboard | URL | Use For |
|-----------|-----|---------|
| Basta Dashboard | https://dashboard.basta.app/ | Manage auctions, view sales/items, bidder admin |
| Stripe Dashboard | https://dashboard.stripe.com/ | Invoices, payments, refunds, webhook logs |
| Vercel Dashboard | https://vercel.com/ (project page) | Deployments, function logs, cron job status, env vars |
| CJ Dropshipping | https://cjdropshipping.com/ | Order status, balance, product catalog, API settings |
| Resend Dashboard | https://resend.com/ | Email delivery logs, API key management |

**Basta Account ID:** `68ef01b4-b445-4d04-8f52-62a1e30763a3`

---

## 8. Lot Status Lifecycle (Quick Reference)

### Success Path

```
SOURCED --> LISTED --> PUBLISHED --> AUCTION_CLOSED --> PAID --> CJ_ORDERED --> CJ_PAID --> SHIPPED --> DELIVERED
```

### Failure Branches

```
PUBLISHED -----> RESERVE_NOT_MET     (bid too low, no action needed)
AUCTION_CLOSED -> PAYMENT_FAILED     (card declined, Stripe retries)
PAID ----------> CJ_OUT_OF_STOCK     (auto-refund via cron)
PAID ----------> CJ_PRICE_CHANGED    (auto-refund via cron)
Any status ----> CANCELLED           (terminal, check error_message)
```

---

## 9. Cron Jobs

| Endpoint | Schedule | Max Runtime | What It Does |
|----------|----------|-------------|--------------|
| `/api/cron/process` | Every 10 minutes | 60 sec | Polls closed sales, retries fulfillments, processes refunds, checks CJ quota |
| `/api/cron/source` | Daily 8:00 AM UTC | 120 sec | Picks next keyword, runs full sourcing pipeline, publishes sale |

Both require the `CRON_SECRET` Bearer token. Defined in `vercel.json`.

---

## 10. Pricing Model

Reserve prices are computed by a financial model (`lib/auction-pricing.ts`) that **guarantees non-negative profit** after all fees and risk buffers.

### The Formula

```
Reserve >= [C * (1 + CJ_buffer) * (1 + margin) + Stripe_fixed] / [(1 + BP) * (1 - Stripe_%)]
```

| Variable | Default | Meaning |
|----------|---------|---------|
| C | product + shipping cost | CJ total cost in cents |
| CJ_buffer | 20% | CJ price can rise this much before fulfillment guard aborts |
| margin | 5% | Minimum safety profit above break-even |
| Stripe_% | 2.9% | Stripe percentage fee |
| Stripe_fixed | $0.30 | Stripe flat fee per transaction |
| BP | 15% | Buyer premium rate (configurable via `--buyer-premium`) |

### Starting Bids

Starting bids use **penny-staggered auction psychology**:
- Low starts attract more bidders (auction theory: more competition = higher final prices)
- Non-round cents ($2.87, $0.73, $4.91) create organic marketplace appearance
- Tiered by cost: cheap items start at pennies, expensive items start higher
- Deterministic: same product always gets same starting bid (xorshift hash)

### Fee Structure

- **Buyer pays:** hammer price + buyer premium (added to Stripe invoice)
- **Platform keeps:** hammer price + buyer premium - Stripe fees - CJ cost
- **Stripe takes:** 2.9% + $0.30 of total invoice (hammer + premium)
- Account fees configured via `tsx scripts/setup-account-fees.ts --list`

---

## 11. Weekly Bulk Auction Workflow

For running weekly bulk auctions with the smart sourcing agent:

### Planning (Monday/Tuesday)

1. Check CJ API quota: `pnpm pipeline:status` — ensure enough quota for ~1,610 calls
2. Review previous week's auction results in Basta Dashboard
3. Adjust parameters if needed (buyer premium, number of auctions, items per auction)

### Dry Run (Tuesday/Wednesday)

```bash
pnpm pipeline:smart-source --dry-run --num-auctions 3 --items-per-auction 300
```

Review the output:
- Category distribution (is it diverse?)
- Score distribution (are there enough high-quality candidates?)
- Cost distribution (is the price sweet spot well represented?)
- Pricing table (are reserves and starting bids reasonable?)
- Stagger statistics (are starting bids sufficiently varied?)

### Full Run (Wednesday)

```bash
pnpm pipeline:smart-source --publish --num-auctions 3 --items-per-auction 300
```

Expected runtime: ~1.5-2 hours (Phase 1: ~4min, Phase 2: ~30min, Phase 3: ~60-90min)

If interrupted, resume with:
```bash
pnpm pipeline:smart-source --resume <runId> --publish
```

### Monitor (Thursday-Saturday)

```bash
pnpm pipeline:monitor --sale-id <thu-sale-id>
pnpm pipeline:monitor --sale-id <fri-sale-id>
pnpm pipeline:monitor --sale-id <sat-sale-id>
```

Or check status individually:
```bash
pnpm pipeline:status --sale-id <sale-id>
```

### Post-Auction (Sunday)

1. Run `pnpm pipeline:status` for full financial summary
2. Check refund rate (should be below 20%)
3. Check profit margin (should be positive — guaranteed by pricing model)
4. Review which categories performed best for next week's planning

---

## 12. Guardrails -- Do Not Violate

### Standard Sourcing
- **Max 5 products per standard sourcing run** -- each product uses 3-4 CJ API calls (~15-20 total)
- **Max 2 standard sourcing runs per day** on the free CJ tier

### Smart Sourcing
- **~1,610 CJ API calls per full smart sourcing run** -- do not run on free CJ tier without verifying quota
- **Always dry-run first** -- `pnpm pipeline:smart-source --dry-run` to verify scoring and category diversity
- **Use `--resume` for interrupted runs** -- never restart from scratch if progress was saved

### Shared
- **Max $50 wholesale cost** -- higher items need explicit approval
- **Always check quota before manual sourcing** -- `pnpm pipeline:status` shows it
- **Never bypass the 1.2-second CJ API delay** -- built into the client to avoid rate limits
- **Verify images uploaded** before considering a sale ready -- check sourcing output for "Image X: uploaded"
- **Never sell below the computed reserve** -- the financial model in `lib/auction-pricing.ts` guarantees profit after all fees
- **CJ tokens:** access = 15 days, refresh = 180 days. Stored in `.cj-token.json`. Delete to force re-auth.
