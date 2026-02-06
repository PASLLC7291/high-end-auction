-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Payment profiles (linked to users)
CREATE TABLE IF NOT EXISTS payment_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  stripe_customer_id TEXT NOT NULL,
  default_payment_method_id TEXT,
  billing_name TEXT,
  billing_line1 TEXT,
  billing_line2 TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_postal_code TEXT,
  billing_country TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Payment orders (auction purchases)
CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY,
  basta_order_id TEXT UNIQUE NOT NULL,
  sale_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  stripe_invoice_id TEXT,
  stripe_invoice_url TEXT,
  status TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_sale_user ON payment_orders(sale_id, user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_stripe_invoice ON payment_orders(stripe_invoice_id);

-- Payment order items
CREATE TABLE IF NOT EXISTS payment_order_items (
  id TEXT PRIMARY KEY,
  basta_order_id TEXT NOT NULL,
  item_id TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_order_items_order ON payment_order_items(basta_order_id);

-- Invoice attempt audit log
CREATE TABLE IF NOT EXISTS invoice_attempts (
  id TEXT PRIMARY KEY,
  basta_order_id TEXT NOT NULL,
  sale_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  stripe_invoice_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_invoice_attempts_order ON invoice_attempts(basta_order_id);

-- Webhook events for idempotency
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (provider, idempotency_key)
);

-- Index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- User profiles (optional extended information)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  phone TEXT,
  location TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- User notification/preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  email_notifications INTEGER NOT NULL DEFAULT 1,
  bid_alerts INTEGER NOT NULL DEFAULT 1,
  marketing_emails INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Watchlist (items a user is following)
CREATE TABLE IF NOT EXISTS watchlist_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  sale_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, sale_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist_items(user_id);

-- Marketing / lead capture (contact, newsletter, consultations, valuations)
CREATE TABLE IF NOT EXISTS lead_submissions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  email TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS lead_uploads (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES lead_submissions(id),
  original_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Lead uploads (optional) binary storage for serverless deployments.
-- When used, `lead_uploads.path` stores a non-filesystem identifier (e.g. `db:lead_upload_files:<id>`).
CREATE TABLE IF NOT EXISTS lead_upload_files (
  id TEXT PRIMARY KEY,
  data BLOB NOT NULL,
  sha256 TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_lead_submissions_type ON lead_submissions(type);
CREATE INDEX IF NOT EXISTS idx_lead_submissions_email ON lead_submissions(email);
CREATE INDEX IF NOT EXISTS idx_lead_uploads_submission ON lead_uploads(submission_id);
CREATE INDEX IF NOT EXISTS idx_lead_upload_files_created ON lead_upload_files(created_at);

-- Prevent duplicate newsletter subscriptions for the same email
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_newsletter_unique
  ON lead_submissions(email)
  WHERE type = 'newsletter' AND email IS NOT NULL;

-- Balance promotions (promo codes)
CREATE TABLE IF NOT EXISTS balance_promotions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  starts_at TEXT,
  ends_at TEXT,
  max_redemptions INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_balance_promotions_code
  ON balance_promotions(code COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS balance_promotion_redemptions (
  id TEXT PRIMARY KEY,
  promotion_id TEXT NOT NULL REFERENCES balance_promotions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  stripe_customer_id TEXT,
  stripe_transaction_id TEXT,
  amount_cents INTEGER NOT NULL,
  redeemed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (promotion_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_balance_redemptions_promotion ON balance_promotion_redemptions(promotion_id);
CREATE INDEX IF NOT EXISTS idx_balance_redemptions_user ON balance_promotion_redemptions(user_id);

-- Dropship lots (CJ Dropshipping <-> Basta <-> Stripe fulfillment mapping)
CREATE TABLE IF NOT EXISTS dropship_lots (
  id TEXT PRIMARY KEY,
  -- CJ source data
  cj_pid TEXT NOT NULL,
  cj_vid TEXT NOT NULL,
  cj_product_name TEXT NOT NULL,
  cj_variant_name TEXT,
  cj_cost_cents INTEGER NOT NULL,
  cj_shipping_cents INTEGER NOT NULL DEFAULT 0,
  cj_logistic_name TEXT,
  cj_from_country TEXT DEFAULT 'CN',
  cj_images TEXT,
  -- Basta mapping
  basta_sale_id TEXT,
  basta_item_id TEXT,
  starting_bid_cents INTEGER NOT NULL,
  reserve_cents INTEGER NOT NULL,
  -- Auction result
  winner_user_id TEXT,
  winning_bid_cents INTEGER,
  -- Payment
  basta_order_id TEXT,
  stripe_invoice_id TEXT,
  -- CJ fulfillment
  cj_order_id TEXT,
  cj_order_number TEXT,
  cj_order_status TEXT,
  cj_paid_at TEXT,
  -- Shipping
  shipping_name TEXT,
  shipping_address TEXT,
  tracking_number TEXT,
  tracking_carrier TEXT,
  -- Margins
  total_cost_cents INTEGER,
  profit_cents INTEGER,
  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'SOURCED',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_dropship_lots_status ON dropship_lots(status);
CREATE INDEX IF NOT EXISTS idx_dropship_lots_basta_item ON dropship_lots(basta_item_id);
CREATE INDEX IF NOT EXISTS idx_dropship_lots_basta_sale ON dropship_lots(basta_sale_id);
CREATE INDEX IF NOT EXISTS idx_dropship_lots_cj_order ON dropship_lots(cj_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dropship_lots_cj_vid_sale ON dropship_lots(cj_vid, basta_sale_id);
