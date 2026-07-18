-- Initial quoting schema for iQuote.

create extension if not exists pgcrypto;

create type public.opportunity_stage as enum (
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost'
);

create type public.product_status as enum (
  'active',
  'inactive',
  'discontinued'
);

create type public.discount_policy_type as enum (
  'percent_off',
  'amount_off'
);

create type public.quote_status as enum (
  'draft',
  'needs_information',
  'pending_approval',
  'approved',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'cancelled'
);

create type public.approval_status as enum (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

create type public.workflow_event_type as enum (
  'created',
  'updated',
  'extraction_failed',
  'submitted_for_approval',
  'approval_requested',
  'approved',
  'rejected',
  'sent',
  'accepted',
  'cancelled',
  'expired'
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  name text not null,
  legal_name text,
  domain text,
  billing_email text,
  phone text,
  billing_address jsonb not null default '{}'::jsonb,
  shipping_address jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  external_id text unique,
  name text not null,
  stage public.opportunity_stage not null default 'prospecting',
  expected_close_date date,
  owner_id uuid,
  currency_code char(3) not null default 'USD',
  estimated_amount numeric(12,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunities_estimated_amount_non_negative check (estimated_amount >= 0)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text,
  status public.product_status not null default 'active',
  unit_of_measure text not null default 'each',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_aliases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  alias text not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint product_aliases_alias_not_blank check (length(btrim(alias)) > 0),
  constraint product_aliases_product_alias_source_unique unique (product_id, alias, source)
);

create table public.prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  currency_code char(3) not null default 'USD',
  unit_price numeric(12,2) not null,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now(),
  constraint prices_unit_price_non_negative check (unit_price >= 0),
  constraint prices_effective_range_valid check (effective_to is null or effective_to >= effective_from)
);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  location_code text not null default 'default',
  quantity_on_hand numeric(14,4) not null default 0,
  quantity_reserved numeric(14,4) not null default 0,
  reorder_point numeric(14,4) not null default 0,
  updated_at timestamptz not null default now(),
  constraint inventory_quantity_on_hand_non_negative check (quantity_on_hand >= 0),
  constraint inventory_quantity_reserved_non_negative check (quantity_reserved >= 0),
  constraint inventory_reorder_point_non_negative check (reorder_point >= 0),
  constraint inventory_product_location_unique unique (product_id, location_code)
);

create table public.discount_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  policy_type public.discount_policy_type not null default 'percent_off',
  discount_bps integer not null default 0,
  max_discount_bps integer not null default 0,
  amount_off numeric(12,2) not null default 0,
  starts_on date,
  ends_on date,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discount_policies_discount_bps_valid check (discount_bps between 0 and 10000),
  constraint discount_policies_max_discount_bps_valid check (max_discount_bps between 0 and 10000),
  constraint discount_policies_discount_within_max check (discount_bps <= max_discount_bps),
  constraint discount_policies_amount_off_non_negative check (amount_off >= 0),
  constraint discount_policies_date_range_valid check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.opportunities(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  quote_number text not null unique,
  status public.quote_status not null default 'draft',
  currency_code char(3) not null default 'USD',
  subtotal_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  valid_until date,
  submitted_at timestamptz,
  approved_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotes_subtotal_amount_non_negative check (subtotal_amount >= 0),
  constraint quotes_discount_amount_non_negative check (discount_amount >= 0),
  constraint quotes_tax_amount_non_negative check (tax_amount >= 0),
  constraint quotes_total_amount_non_negative check (total_amount >= 0)
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  line_number integer not null,
  sku text not null,
  description text not null,
  quantity numeric(14,4) not null,
  unit_price numeric(12,2) not null,
  discount_bps integer not null default 0,
  discount_amount numeric(12,2) not null default 0,
  line_total_amount numeric(12,2) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint quote_items_line_number_positive check (line_number > 0),
  constraint quote_items_quantity_positive check (quantity > 0),
  constraint quote_items_unit_price_non_negative check (unit_price >= 0),
  constraint quote_items_discount_bps_valid check (discount_bps between 0 and 10000),
  constraint quote_items_discount_amount_non_negative check (discount_amount >= 0),
  constraint quote_items_line_total_amount_non_negative check (line_total_amount >= 0),
  constraint quote_items_quote_line_unique unique (quote_id, line_number)
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  required_role text not null,
  status public.approval_status not null default 'pending',
  requested_by uuid,
  approver_id uuid,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  comments text,
  metadata jsonb not null default '{}'::jsonb,
  constraint approvals_required_role_not_blank check (length(btrim(required_role)) > 0)
);

create table public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  event_type public.workflow_event_type not null,
  actor_id uuid,
  from_status public.quote_status,
  to_status public.quote_status,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index customers_name_idx on public.customers (name);
create index opportunities_customer_id_idx on public.opportunities (customer_id);
create index opportunities_stage_idx on public.opportunities (stage);
create index products_status_idx on public.products (status);
create index product_aliases_alias_idx on public.product_aliases (alias);
create index prices_product_id_idx on public.prices (product_id);
create index prices_product_currency_effective_idx on public.prices (product_id, currency_code, effective_from desc);
create index inventory_product_id_idx on public.inventory (product_id);
create index discount_policies_active_idx on public.discount_policies (active);
create index quotes_customer_id_idx on public.quotes (customer_id);
create index quotes_opportunity_id_idx on public.quotes (opportunity_id);
create index quotes_status_idx on public.quotes (status);
create index quote_items_quote_id_idx on public.quote_items (quote_id);
create index quote_items_product_id_idx on public.quote_items (product_id);
create index approvals_quote_id_idx on public.approvals (quote_id);
create index approvals_status_idx on public.approvals (status);
create unique index approvals_one_pending_per_quote_role_idx
  on public.approvals (quote_id, required_role)
  where status = 'pending';
create index workflow_events_quote_id_created_at_idx on public.workflow_events (quote_id, created_at desc);
create index workflow_events_event_type_idx on public.workflow_events (event_type);
