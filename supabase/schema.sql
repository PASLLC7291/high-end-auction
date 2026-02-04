create extension if not exists "pgcrypto";

create table if not exists payment_profiles (
  user_id text primary key,
  stripe_customer_id text not null,
  default_payment_method_id text,
  billing_name text,
  billing_line1 text,
  billing_line2 text,
  billing_city text,
  billing_state text,
  billing_postal_code text,
  billing_country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_orders (
  id uuid primary key default gen_random_uuid(),
  basta_order_id text unique not null,
  sale_id text not null,
  user_id text not null,
  stripe_invoice_id text,
  stripe_invoice_url text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_order_items (
  id uuid primary key default gen_random_uuid(),
  basta_order_id text not null,
  item_id text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  idempotency_key text not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  unique (provider, idempotency_key)
);
