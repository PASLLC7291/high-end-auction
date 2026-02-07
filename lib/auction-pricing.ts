/**
 * Auction Pricing — Financial model for reserve prices and starting bids.
 *
 * GUARANTEE: The reserve price is the absolute minimum winning bid that
 * still produces a non-negative net profit after accounting for:
 *   1. Stripe processing fees (2.9% + $0.30 on total invoice)
 *   2. Buyer premium (if configured — this is ADDITIONAL revenue)
 *   3. CJ price fluctuation buffer (up to 20% increase before guard aborts)
 *   4. A configurable safety margin on top
 *
 * STARTING BIDS: Psychologically-tuned penny-level amounts that create the
 * appearance of organic bidding activity. Staggered, non-round prices like
 * $3.47 or $7.82 feel more "real" than $3.50 or $8.00.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * THE MATH
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Variables:
 *   C     = CJ total cost (product + shipping) in cents
 *   R     = reserve (minimum winning bid) in cents
 *   BP    = buyer premium rate (e.g. 0.15 for 15%)
 *   S_pct = Stripe percentage fee (0.029)
 *   S_fix = Stripe fixed fee (30 cents)
 *   F     = CJ price fluctuation buffer (0.20 = 20%)
 *   M     = safety margin (e.g. 0.05 = 5% profit minimum)
 *
 * What we collect from the buyer:
 *   gross_revenue = R + R * BP = R * (1 + BP)
 *
 * What Stripe takes:
 *   stripe_fee = gross_revenue * S_pct + S_fix
 *
 * What we keep:
 *   net_revenue = gross_revenue - stripe_fee
 *              = R * (1 + BP) * (1 - S_pct) - S_fix
 *
 * Worst-case cost (CJ price can rise up to F before guard aborts):
 *   worst_cost = C * (1 + F)
 *
 * Break-even with safety margin:
 *   net_revenue >= worst_cost * (1 + M)
 *   R * (1 + BP) * (1 - S_pct) - S_fix >= C * (1 + F) * (1 + M)
 *
 * Solving for R:
 *   R >= [C * (1 + F) * (1 + M) + S_fix] / [(1 + BP) * (1 - S_pct)]
 *
 * ──────────────────────────────────────────────────────────────────────────
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Stripe processing: 2.9% */
const STRIPE_PERCENTAGE = 0.029;

/** Stripe processing: $0.30 flat per transaction */
const STRIPE_FIXED_CENTS = 30;

/** CJ price can rise up to 20% before the fulfillment guard aborts */
const CJ_PRICE_FLUCTUATION_BUFFER = 0.20;

/** Minimum safety margin above break-even (5% = we always make at least 5%) */
const DEFAULT_SAFETY_MARGIN = 0.05;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PricingParams = {
  /** CJ product cost in cents */
  productCostCents: number;
  /** CJ shipping cost in cents */
  shippingCostCents: number;
  /** Buyer premium rate (0.15 = 15%). Pass 0 if no premium configured. */
  buyerPremiumRate: number;
  /** CJ suggested retail price in cents (used for starting bid calibration) */
  suggestedRetailCents?: number;
  /** Override the default safety margin (0.05 = 5%) */
  safetyMargin?: number;
  /** Override the CJ price fluctuation buffer (0.20 = 20%) */
  priceFluctuationBuffer?: number;
};

export type PricingResult = {
  /** Reserve price in cents — minimum winning bid to guarantee profit */
  reserveCents: number;
  /** Starting bid in cents — psychologically-tuned low anchor */
  startingBidCents: number;
  /** Total CJ cost in cents (product + shipping) */
  totalCostCents: number;
  /** Projected net profit if item sells at reserve (worst case), in cents */
  worstCaseNetProfitCents: number;
  /** Break-even winning bid (0% profit), in cents */
  breakEvenBidCents: number;
  /** Effective markup on reserve vs cost */
  reserveMarkup: number;
};

// ---------------------------------------------------------------------------
// Reserve Calculation
// ---------------------------------------------------------------------------

/**
 * Compute the minimum reserve price that guarantees non-negative profit
 * after all fees and risk buffers.
 */
export function computeReserve(params: PricingParams): number {
  const {
    productCostCents,
    shippingCostCents,
    buyerPremiumRate,
    safetyMargin = DEFAULT_SAFETY_MARGIN,
    priceFluctuationBuffer = CJ_PRICE_FLUCTUATION_BUFFER,
  } = params;

  const totalCost = productCostCents + shippingCostCents;

  // Numerator: worst-case cost with safety margin + Stripe fixed fee
  const numerator = totalCost * (1 + priceFluctuationBuffer) * (1 + safetyMargin) + STRIPE_FIXED_CENTS;

  // Denominator: how much of each dollar of hammer price we actually keep
  const denominator = (1 + buyerPremiumRate) * (1 - STRIPE_PERCENTAGE);

  const reserveRaw = numerator / denominator;

  // Round up to nearest cent — never round down on the reserve
  return Math.ceil(reserveRaw);
}

/**
 * Compute break-even bid (0% profit) — useful for diagnostics.
 */
function computeBreakEven(params: PricingParams): number {
  return computeReserve({
    ...params,
    safetyMargin: 0,
    priceFluctuationBuffer: 0,
  });
}

// ---------------------------------------------------------------------------
// Starting Bid: Auction Theory + Psychology
// ---------------------------------------------------------------------------

/**
 * Stagger seed derived from cost — deterministic but appears random.
 * Same product always gets same penny offset, so re-runs are stable.
 *
 * Uses xorshift-style mixing so that even a 1-cent difference in cost
 * produces a completely different stagger value (0-99).
 */
function pennyStagger(costCents: number): number {
  let h = costCents | 0;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = (h >>> 16) ^ h;
  return ((h % 100) + 100) % 100; // always 0-99
}

/**
 * Compute a psychologically-tuned starting bid.
 *
 * Auction theory principles applied:
 *
 * 1. LOW STARTING BIDS attract more bidders. Items with $1 starts get
 *    3-5x more bids than items starting near reserve. More bidders =
 *    more competition = higher final prices. (eBay research, 2006)
 *
 * 2. NON-ROUND PRICES feel organic. $3.47 looks like a real person priced
 *    it; $3.50 looks algorithmic. Odd-cent prices also reduce "anchoring"
 *    to round numbers, encouraging bidders to think in precise values.
 *
 * 3. STAGGERING across the auction prevents a wall of identical prices.
 *    When browsing, seeing $1.00, $1.00, $1.00, $1.00 screams "bot".
 *    Seeing $0.73, $1.22, $2.47, $0.88 looks like a real marketplace.
 *
 * 4. PRICE-PROPORTIONAL starts: cheaper items start lower (as low as
 *    $0.01) while more expensive items start a bit higher to signal
 *    value and avoid "junk" perception.
 *
 * Strategy by cost tier:
 *   $0-$5 total cost   → start at $0.01-$0.99  (penny auction feel)
 *   $5-$15 total cost  → start at $0.50-$3.99   (impulse range)
 *   $15-$30 total cost → start at $1.50-$5.99   (value range)
 *   $30+ total cost    → start at $3.00-$9.99   (premium range)
 */
export function computeStartingBid(params: PricingParams): number {
  const totalCost = params.productCostCents + params.shippingCostCents;
  const stagger = pennyStagger(totalCost);

  // Determine base range from cost tier
  let minCents: number;
  let maxCents: number;

  if (totalCost <= 500) {
    // $0-$5 → penny auction feel
    minCents = 1;
    maxCents = 99;
  } else if (totalCost <= 1500) {
    // $5-$15 → impulse range
    minCents = 50;
    maxCents = 399;
  } else if (totalCost <= 3000) {
    // $15-$30 → value range
    minCents = 150;
    maxCents = 599;
  } else {
    // $30+ → premium range
    minCents = 300;
    maxCents = 999;
  }

  // Scale within range using the stagger
  const range = maxCents - minCents;
  let bid = minCents + Math.round((stagger / 100) * range);

  // Avoid round-dollar amounts (too clean-looking)
  const remainder = bid % 100;
  if (remainder === 0) {
    bid += 13 + (stagger % 37); // add oddball pennies
  } else if (remainder === 50) {
    bid += 7 + (stagger % 23);
  }

  // If suggested retail is available, we can use it as a secondary signal:
  // don't start above 15% of suggested retail (looks suspicious if too high)
  if (params.suggestedRetailCents && params.suggestedRetailCents > 0) {
    const maxFromRetail = Math.round(params.suggestedRetailCents * 0.15);
    if (bid > maxFromRetail && maxFromRetail > minCents) {
      bid = minCents + (stagger % (maxFromRetail - minCents));
    }
  }

  // Floor: never start below 1 cent
  return Math.max(1, bid);
}

// ---------------------------------------------------------------------------
// Combined pricing
// ---------------------------------------------------------------------------

/**
 * Compute both reserve and starting bid for a product.
 * Returns complete pricing with diagnostic data.
 */
export function computePricing(params: PricingParams): PricingResult {
  const totalCostCents = params.productCostCents + params.shippingCostCents;
  const reserveCents = computeReserve(params);
  const startingBidCents = computeStartingBid(params);
  const breakEvenBidCents = computeBreakEven(params);

  // Worst-case net profit: what we make if item sells exactly at reserve
  const grossRevenue = reserveCents * (1 + params.buyerPremiumRate);
  const stripeFee = grossRevenue * STRIPE_PERCENTAGE + STRIPE_FIXED_CENTS;
  const netRevenue = grossRevenue - stripeFee;
  const worstCaseNetProfitCents = Math.round(netRevenue - totalCostCents);

  const reserveMarkup = totalCostCents > 0
    ? (reserveCents - totalCostCents) / totalCostCents
    : 0;

  return {
    reserveCents,
    startingBidCents,
    totalCostCents,
    worstCaseNetProfitCents,
    breakEvenBidCents,
    reserveMarkup,
  };
}

// ---------------------------------------------------------------------------
// Diagnostic: print pricing table for a set of test costs
// ---------------------------------------------------------------------------

/**
 * Print a pricing analysis table — useful for dry runs and verification.
 */
export function printPricingTable(
  items: Array<{
    name: string;
    productCostCents: number;
    shippingCostCents: number;
    suggestedRetailCents?: number;
  }>,
  buyerPremiumRate: number,
): void {
  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  console.log(`\nPricing Analysis (buyer premium: ${(buyerPremiumRate * 100).toFixed(1)}%, Stripe: 2.9% + $0.30)`);
  console.log(`${"Product".padEnd(35)} ${"Cost".padStart(8)} ${"Reserve".padStart(9)} ${"Start".padStart(8)} ${"Markup".padStart(8)} ${"MinProfit".padStart(10)} ${"BreakEven".padStart(10)}`);
  console.log("-".repeat(95));

  for (const item of items) {
    const result = computePricing({
      ...item,
      buyerPremiumRate,
    });

    console.log(
      `${item.name.slice(0, 34).padEnd(35)} ` +
      `${fmt(result.totalCostCents).padStart(8)} ` +
      `${fmt(result.reserveCents).padStart(9)} ` +
      `${fmt(result.startingBidCents).padStart(8)} ` +
      `${(result.reserveMarkup * 100).toFixed(1).padStart(6)}% ` +
      `${fmt(result.worstCaseNetProfitCents).padStart(10)} ` +
      `${fmt(result.breakEvenBidCents).padStart(10)}`
    );
  }
}
