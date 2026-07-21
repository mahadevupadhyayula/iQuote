-- supabase/migrations/20260721000000_grant_service_role_access.sql
--
-- Grants the server-side Supabase service_role access to the iQuote
-- application tables exposed through the Supabase Data API.
--
-- The application uses SUPABASE_SERVICE_ROLE_KEY from server-only code.
-- Do not grant equivalent unrestricted access to anon or authenticated
-- until authentication, tenant isolation, and RLS policies are implemented.

begin;

-- Allow service_role to access objects inside the public schema.
grant usage on schema public to service_role;

-- Grant CRUD access to the current iQuote application tables.
grant select, insert, update, delete
on table
  public.customers,
  public.opportunities,
  public.products,
  public.product_aliases,
  public.prices,
  public.inventory,
  public.discount_policies,
  public.quotes,
  public.quote_items,
  public.approvals,
  public.workflow_events
to service_role;

-- Support any current sequences used by identity or serial columns.
-- The current schema primarily uses UUID keys, but this keeps the
-- migration safe if a sequence-backed column is introduced.
grant usage, select, update
on all sequences in schema public
to service_role;

-- Ensure tables created by future migrations executed as postgres
-- automatically receive the required service_role CRUD privileges.
alter default privileges for role postgres
in schema public
grant select, insert, update, delete on tables
to service_role;

-- Ensure future sequence-backed columns are also usable by service_role.
alter default privileges for role postgres
in schema public
grant usage, select, update on sequences
to service_role;

commit;