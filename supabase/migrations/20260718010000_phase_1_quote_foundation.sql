-- Phase 1 quote foundation schema hardening.
-- Adds deterministic commercial data safeguards and idempotency keys for quote workflows.

do $$
begin
  create type public.price_type as enum (
    'list',
    'customer_tier',
    'customer_specific'
  );
exception
  when duplicate_object then null;
end
$$;

alter table public.prices
  add column if not exists price_type public.price_type not null default 'list',
  add column if not exists customer_tier text,
  add column if not exists customer_id uuid references public.customers(id) on delete restrict,
  add column if not exists unit_cost numeric(12,2) not null default 0,
  add column if not exists source_name text not null default 'manual',
  add column if not exists source_version text not null default '1';

alter table public.inventory
  rename column location_code to warehouse_code;

alter table public.inventory
  add column if not exists available_quantity numeric(14,4) generated always as (quantity_on_hand - quantity_reserved) stored,
  add column if not exists source_name text not null default 'manual',
  add column if not exists source_version text not null default '1',
  add column if not exists refreshed_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

alter table public.discount_policies
  add column if not exists conditions jsonb not null default '{}'::jsonb,
  add column if not exists minimum_margin_bps integer not null default 0;

alter table public.quotes
  add column if not exists sla_due_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.quote_items
  add column if not exists updated_at timestamptz not null default now();

alter table public.approvals
  add column if not exists approval_type text not null default 'standard',
  add column if not exists idempotency_key text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.workflow_events
  add column if not exists idempotency_key text;

alter table public.prices
  add constraint prices_unit_cost_non_negative check (unit_cost >= 0),
  add constraint prices_customer_tier_not_blank check (customer_tier is null or length(btrim(customer_tier)) > 0),
  add constraint prices_source_name_not_blank check (length(btrim(source_name)) > 0),
  add constraint prices_source_version_not_blank check (length(btrim(source_version)) > 0),
  add constraint prices_price_type_scope_valid check (
    (price_type = 'list' and customer_id is null and customer_tier is null)
    or (price_type = 'customer_tier' and customer_id is null and customer_tier is not null)
    or (price_type = 'customer_specific' and customer_id is not null)
  );

alter table public.inventory
  add constraint inventory_quantity_reserved_within_on_hand check (quantity_reserved <= quantity_on_hand),
  add constraint inventory_warehouse_code_not_blank check (length(btrim(warehouse_code)) > 0),
  add constraint inventory_source_name_not_blank check (length(btrim(source_name)) > 0),
  add constraint inventory_source_version_not_blank check (length(btrim(source_version)) > 0);

alter table public.discount_policies
  add constraint discount_policies_minimum_margin_bps_valid check (minimum_margin_bps between 0 and 10000);

alter table public.approvals
  add constraint approvals_approval_type_not_blank check (length(btrim(approval_type)) > 0),
  add constraint approvals_decision_after_request check (decided_at is null or decided_at >= requested_at);

create index if not exists customers_external_id_idx on public.customers (external_id);
create index if not exists customers_name_idx on public.customers (name);
create index if not exists opportunities_customer_id_idx on public.opportunities (customer_id);
create index if not exists opportunities_external_id_idx on public.opportunities (external_id);
create index if not exists products_sku_idx on public.products (sku);
create index if not exists products_status_idx on public.products (status);
create index if not exists product_aliases_alias_lower_idx on public.product_aliases (lower(alias));
create index if not exists prices_product_id_idx on public.prices (product_id);
create index if not exists prices_customer_id_idx on public.prices (customer_id);
create index if not exists prices_customer_tier_idx on public.prices (customer_tier);
create index if not exists prices_price_type_idx on public.prices (price_type);
create index if not exists prices_effective_from_idx on public.prices (effective_from);
create index if not exists prices_effective_to_idx on public.prices (effective_to);
create index if not exists inventory_product_id_idx on public.inventory (product_id);
create index if not exists inventory_warehouse_code_idx on public.inventory (warehouse_code);
create index if not exists quotes_customer_id_idx on public.quotes (customer_id);
create index if not exists quotes_status_idx on public.quotes (status);
create index if not exists quotes_quote_number_idx on public.quotes (quote_number);
create index if not exists approvals_quote_id_idx on public.approvals (quote_id);
create index if not exists approvals_status_idx on public.approvals (status);
create index if not exists approvals_quote_id_status_idx on public.approvals (quote_id, status);
create index if not exists workflow_events_quote_id_idx on public.workflow_events (quote_id);
create index if not exists workflow_events_created_at_idx on public.workflow_events (created_at);
create index if not exists workflow_events_quote_id_created_at_idx on public.workflow_events (quote_id, created_at desc);

create unique index if not exists approvals_quote_type_idempotency_key_idx
  on public.approvals (quote_id, approval_type, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists approvals_open_quote_type_idx
  on public.approvals (quote_id, approval_type)
  where status = 'pending';

create unique index if not exists workflow_events_quote_idempotency_key_idx
  on public.workflow_events (quote_id, idempotency_key)
  where idempotency_key is not null;
