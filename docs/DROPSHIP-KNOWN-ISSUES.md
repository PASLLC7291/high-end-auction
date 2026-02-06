# Dropship Pipeline — Known Issues & Edge Cases

Logged during implementation. Address before production.

## Critical (must fix)

### 1. Reserve not met → still triggers order flow
**Where:** `app/api/webhooks/basta/route.ts` → `handleItemsClosed`
**Issue:** Basta fires `ItemsStatusChanged(CLOSED)` with a `newLeader` even if the bid is below reserve. The code filters on `item.leaderId && item.currentBid` but does NOT check `currentBid >= reserve`. This creates a Basta order + Stripe invoice for an item that shouldn't sell.
**Fix:** After fetching sale items, also fetch the item's `reserve` field and skip items where `currentBid < reserve`. Alternatively, Basta may not set `leaderId` when reserve isn't met — needs testing to confirm behavior.

### 2. CJ inventory evaporates between listing and fulfillment
**Where:** `lib/dropship-fulfillment.ts` → `fulfillDropshipLot`
**Status:** GUARDED — re-checks inventory before ordering. Lot marked `CJ_OUT_OF_STOCK` if empty.
**Remaining risk:** Need a refund flow when this happens (Stripe refund + user notification). Currently just logs an error.

### 3. CJ price increases beyond margin
**Where:** `lib/dropship-fulfillment.ts` → `fulfillDropshipLot`
**Status:** GUARDED — re-checks price, blocks if >20% increase. Lot marked `CJ_PRICE_CHANGED`.
**Remaining risk:** Same as #2 — need refund flow.

## Important (should fix soon)

### 4. Winner doesn't pay / Stripe invoice expires
**Where:** Stripe invoices auto-advance but can fail
**Issue:** No timeout mechanism. If a winner's card fails and they never pay, the lot stays in `INVOICE_ISSUED` forever.
**Fix:** Add a polling cron that checks `payment_orders` with status `INVOICE_ISSUED` older than 48h and either retries or marks as `PAYMENT_FAILED`.

### 5. No shipping address collection
**Where:** `app/api/webhooks/stripe/dropship-hook.ts` → `extractShippingAddress`
**Issue:** The existing flow uses Stripe Invoices (not Checkout Sessions). Invoices don't collect shipping addresses by default. The `customer_shipping` field is only populated if you set it on the Stripe customer.
**Fix:** Either (a) switch to Stripe Checkout for dropship lots to collect address, (b) collect shipping address in the bidder registration flow and store in `payment_profiles`, or (c) require address on signup.

### 6. Webhook delivery not guaranteed
**Where:** All webhook handlers
**Issue:** If a webhook fails to deliver, that lot gets stuck.
**Fix:** Build a polling fallback cron that queries Basta `sale` + CJ `GET /order/list` to catch missed events. Check `dropship_lots` for lots stuck in transitional states for >1h.

## Minor (nice to have)

### 7. Unit mismatch potential
- Basta: cents (int) — `startingBid: 1500` = $15.00
- CJ: dollars (float) — `variantSellPrice: 12.50` = $12.50
- Stripe: cents (int) — `amount: 3900` = $39.00
- All conversions use `Math.round(price * 100)` — watch for floating point edge cases.

### 8. Single variant only
The sourcing script picks `variants[0]` for each product. Products with multiple size/color variants are listed as a single lot. Future: support variant selection or list multiple lots per product.

### 9. CJ API rate limits
- Free tier: 1 req/s
- Token refresh: once per 5 minutes
- Need exponential backoff for bulk operations

### 10. Image hosting
CJ product images are on CJ's CDN. If CJ changes URLs or throttles, lot images break. Consider mirroring to Cloudinary (already in the stack via `lib/cloudinary.ts`).
