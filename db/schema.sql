-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Payment order items
CREATE TABLE IF NOT EXISTS payment_order_items (
  id TEXT PRIMARY KEY,
  basta_order_id TEXT NOT NULL,
  item_id TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Webhook events for idempotency
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, idempotency_key)
);

-- Index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- User profiles (optional extended information)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  phone TEXT,
  location TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User notification/preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  email_notifications INTEGER NOT NULL DEFAULT 1,
  bid_alerts INTEGER NOT NULL DEFAULT 1,
  marketing_emails INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Watchlist (items a user is following)
CREATE TABLE IF NOT EXISTS watchlist_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  sale_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, sale_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist_items(user_id);

-- Marketing / lead capture (contact, newsletter, consultations, valuations)
CREATE TABLE IF NOT EXISTS lead_submissions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  email TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lead_uploads (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES lead_submissions(id),
  original_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lead_submissions_type ON lead_submissions(type);
CREATE INDEX IF NOT EXISTS idx_lead_submissions_email ON lead_submissions(email);
CREATE INDEX IF NOT EXISTS idx_lead_uploads_submission ON lead_uploads(submission_id);

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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  redeemed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (promotion_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_balance_redemptions_promotion ON balance_promotion_redemptions(promotion_id);
CREATE INDEX IF NOT EXISTS idx_balance_redemptions_user ON balance_promotion_redemptions(user_id);
