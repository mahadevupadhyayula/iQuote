-- Demo data for deterministic quote workflow scenarios.
-- Safe to re-run: removes only records tagged with metadata.demo_seed in ('atlas-northstar', 'atlas-northstar-sterling').

begin;

with demo_products as (
  select id from public.products where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling')
), demo_customers as (
  select id from public.customers where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling')
), demo_opportunities as (
  select id from public.opportunities where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling')
), demo_quotes as (
  select id from public.quotes
  where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling')
     or customer_id in (select id from demo_customers)
     or opportunity_id in (select id from demo_opportunities)
)
delete from public.workflow_events where quote_id in (select id from demo_quotes);

with demo_products as (
  select id from public.products where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling')
), demo_customers as (
  select id from public.customers where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling')
), demo_opportunities as (
  select id from public.opportunities where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling')
), demo_quotes as (
  select id from public.quotes
  where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling')
     or customer_id in (select id from demo_customers)
     or opportunity_id in (select id from demo_opportunities)
)
delete from public.approvals where quote_id in (select id from demo_quotes);

with demo_products as (
  select id from public.products where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling')
), demo_customers as (
  select id from public.customers where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling')
), demo_opportunities as (
  select id from public.opportunities where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling')
), demo_quotes as (
  select id from public.quotes
  where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling')
     or customer_id in (select id from demo_customers)
     or opportunity_id in (select id from demo_opportunities)
)
delete from public.quote_items where quote_id in (select id from demo_quotes) or product_id in (select id from demo_products);

delete from public.quotes where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling');
delete from public.prices where product_id in (select id from public.products where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling')) or customer_id in (select id from public.customers where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling'));
delete from public.inventory where product_id in (select id from public.products where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling'));
delete from public.product_aliases where product_id in (select id from public.products where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling'));
delete from public.discount_policies where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling');
delete from public.opportunities where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling');
delete from public.products where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling');
delete from public.customers where metadata ->> 'demo_seed' in ('atlas-northstar', 'atlas-northstar-sterling');

insert into public.customers (id, external_id, name, legal_name, domain, billing_email, phone, billing_address, shipping_address, metadata)
values
  ('10000000-0000-4000-8000-000000000001', 'DEMO-CUST-ATLAS', 'Atlas Manufacturing', 'Atlas Manufacturing, Inc.', 'atlas.example', 'ap@atlas.example', '+1-312-555-0142', '{"line1":"2300 Foundry Way","city":"Chicago","region":"IL","postalCode":"60601","country":"US"}', '{"line1":"4100 Assembly Park","city":"Cicero","region":"IL","postalCode":"60804","country":"US"}', '{"demo_seed":"atlas-northstar-sterling","segment":"manufacturing","customer_tier":"gold","demo_scenario":"straight_through"}'),
  ('10000000-0000-4000-8000-000000000002', 'DEMO-CUST-NORTHSTAR', 'Northstar Mining', 'Northstar Mining Ltd.', 'northstar.example', 'procurement@northstar.example', '+1-406-555-0198', '{"line1":"88 Ore Ridge Road","city":"Billings","region":"MT","postalCode":"59101","country":"US"}', '{"line1":"12 Pit Access Road","city":"Butte","region":"MT","postalCode":"59701","country":"US"}', '{"demo_seed":"atlas-northstar-sterling","segment":"mining","customer_tier":"silver","demo_scenario":"split_inventory"}'),
  ('10000000-0000-4000-8000-000000000003', 'DEMO-CUST-STERLING', 'Sterling Works', 'Sterling Works LLC', 'sterling.example', 'quotes@sterling.example', '+1-713-555-0177', '{"line1":"701 Fabrication Loop","city":"Houston","region":"TX","postalCode":"77002","country":"US"}', '{"line1":"701 Fabrication Loop","city":"Houston","region":"TX","postalCode":"77002","country":"US"}', '{"demo_seed":"atlas-northstar-sterling","segment":"industrial_services","customer_tier":"standard","demo_scenario":"insufficient_inventory"}');

insert into public.products (id, sku, name, description, status, unit_of_measure, metadata)
values
  ('20000000-0000-4000-8000-000000000200', 'AX-200', 'AX-200 Industrial Compressor', 'Heavy-duty industrial compressor for automated production cells.', 'active', 'each', '{"demo_seed":"atlas-northstar-sterling","family":"compressors"}'),
  ('20000000-0000-4000-8000-000000000500', 'HX-500', 'HX-500 Hydraulic Pump', 'High-flow hydraulic pump for mining conveyors and crushers.', 'active', 'each', '{"demo_seed":"atlas-northstar-sterling","family":"hydraulics"}'),
  ('20000000-0000-4000-8000-000000000600', 'HX-500R', 'HX-500R Hydraulic Pump Replacement Kit', 'Drop-in replacement kit for constrained HX-500 demand.', 'active', 'each', '{"demo_seed":"atlas-northstar-sterling","family":"hydraulics","replaces":"HX-500"}'),
  ('20000000-0000-4000-8000-000000000700', 'INST-PKG', 'Installation Package', 'Standard on-site installation and commissioning package.', 'active', 'service', '{"demo_seed":"atlas-northstar-sterling","family":"services"}');

insert into public.product_aliases (product_id, alias, source)
values
  ('20000000-0000-4000-8000-000000000200', 'AX200', 'customer_csv'),
  ('20000000-0000-4000-8000-000000000200', 'Atlas compressor 200', 'manual'),
  ('20000000-0000-4000-8000-000000000500', 'HX500', 'customer_csv'),
  ('20000000-0000-4000-8000-000000000500', 'Northstar pump', 'manual'),
  ('20000000-0000-4000-8000-000000000600', 'HX-500 replacement', 'manual'),
  ('20000000-0000-4000-8000-000000000700', 'installation package', 'manual');

-- Warehouse master data is represented by deterministic warehouse codes on inventory rows.
-- CHI-01 = Chicago, HOU-01 = Houston, DEN-01 = Denver.
insert into public.prices (id, product_id, currency_code, unit_price, effective_from, effective_to, price_type, customer_tier, customer_id, unit_cost, source_name, source_version)
values
  -- List prices for every product.
  ('40000000-0000-4000-8000-000000000201', '20000000-0000-4000-8000-000000000200', 'USD', 1280.00, '2026-01-01', null, 'list', null, null, 820.00, 'demo_erp_pricebook', '2026.07.18'),
  ('40000000-0000-4000-8000-000000000501', '20000000-0000-4000-8000-000000000500', 'USD', 3425.00, '2026-01-01', '2026-09-30', 'list', null, null, 2380.00, 'demo_erp_pricebook', '2026.07.18'),
  ('40000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000600', 'USD', 3195.00, '2026-07-01', null, 'list', null, null, 2210.00, 'demo_erp_pricebook', '2026.07.18'),
  ('40000000-0000-4000-8000-000000000701', '20000000-0000-4000-8000-000000000700', 'USD', 650.00, '2026-01-01', null, 'list', null, null, 275.00, 'demo_services_rate_card', '2026.07.18'),
  -- Customer-tier prices for the relevant seeded customer tiers.
  ('40000000-0000-4000-8000-000000000202', '20000000-0000-4000-8000-000000000200', 'USD', 1185.00, '2026-01-01', null, 'customer_tier', 'gold', null, 820.00, 'demo_contract_tier_pricing', '2026.07.18'),
  ('40000000-0000-4000-8000-000000000502', '20000000-0000-4000-8000-000000000500', 'USD', 3290.00, '2026-01-01', '2026-09-30', 'customer_tier', 'silver', null, 2380.00, 'demo_contract_tier_pricing', '2026.07.18'),
  ('40000000-0000-4000-8000-000000000702', '20000000-0000-4000-8000-000000000700', 'USD', 600.00, '2026-01-01', null, 'customer_tier', 'gold', null, 275.00, 'demo_contract_tier_pricing', '2026.07.18'),
  -- Customer-specific prices outrank tier and list pricing.
  ('40000000-0000-4000-8000-000000000203', '20000000-0000-4000-8000-000000000200', 'USD', 1125.00, '2026-04-01', null, 'customer_specific', null, '10000000-0000-4000-8000-000000000001', 820.00, 'demo_customer_contract', 'ATLAS-2026-Q2'),
  ('40000000-0000-4000-8000-000000000503', '20000000-0000-4000-8000-000000000500', 'USD', 3150.00, '2026-07-01', '2026-12-31', 'customer_specific', null, '10000000-0000-4000-8000-000000000002', 2380.00, 'demo_customer_contract', 'NORTHSTAR-2026-H2');

insert into public.inventory (id, product_id, warehouse_code, quantity_on_hand, quantity_reserved, reorder_point, source_name, source_version, refreshed_at)
values
  -- Straight-through scenario: Atlas AX-200 can ship from Chicago alone.
  ('50000000-0000-4000-8000-000000000201', '20000000-0000-4000-8000-000000000200', 'CHI-01', 18, 2, 4, 'demo_wms_snapshot', '2026.07.18T00:00Z', '2026-07-18T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000202', '20000000-0000-4000-8000-000000000200', 'HOU-01', 4, 1, 3, 'demo_wms_snapshot', '2026.07.18T00:00Z', '2026-07-18T00:00:00Z'),
  -- Split scenario: Northstar HX-500 requires Denver + Houston for medium demand.
  ('50000000-0000-4000-8000-000000000501', '20000000-0000-4000-8000-000000000500', 'DEN-01', 4, 1, 2, 'demo_wms_snapshot', '2026.07.18T00:00Z', '2026-07-18T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000502', '20000000-0000-4000-8000-000000000500', 'HOU-01', 3, 0, 2, 'demo_wms_snapshot', '2026.07.18T00:00Z', '2026-07-18T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000503', '20000000-0000-4000-8000-000000000500', 'CHI-01', 1, 0, 1, 'demo_wms_snapshot', '2026.07.18T00:00Z', '2026-07-18T00:00:00Z'),
  -- Replacement SKU scenario: HX-500R has enough stock to substitute when HX-500 is short.
  ('50000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000600', 'DEN-01', 9, 1, 2, 'demo_wms_snapshot', '2026.07.18T00:00Z', '2026-07-18T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000602', '20000000-0000-4000-8000-000000000600', 'HOU-01', 5, 0, 2, 'demo_wms_snapshot', '2026.07.18T00:00Z', '2026-07-18T00:00:00Z'),
  -- Service item inventory rows keep warehouse references deterministic without adding physical stock.
  ('50000000-0000-4000-8000-000000000701', '20000000-0000-4000-8000-000000000700', 'CHI-01', 0, 0, 0, 'demo_services_capacity', '2026.07.18T00:00Z', '2026-07-18T00:00:00Z');

insert into public.discount_policies (id, name, description, policy_type, discount_bps, max_discount_bps, amount_off, starts_on, ends_on, active, conditions, minimum_margin_bps, metadata)
values
  ('30000000-0000-4000-8000-000000000001', 'Normal allowed demo discount', 'Gold customers may receive an 8% discount on AX-200 quantities of 10 or more without additional approval.', 'percent_off', 800, 1000, 0, '2026-01-01', null, true, '{"customer_tier":"gold","sku":"AX-200","minimum_quantity":10,"approval_required_above_bps":1000}', 2500, '{"demo_seed":"atlas-northstar-sterling","demo_case":"normal_allowed_discount"}'),
  ('30000000-0000-4000-8000-000000000002', 'Approval required demo discount', 'Silver mining customers may request up to 18% on HX-500, with approval required above 12%.', 'percent_off', 1200, 1800, 0, '2026-01-01', '2026-12-31', true, '{"customer_tier":"silver","sku":"HX-500","approval_required_above_bps":1200}', 2200, '{"demo_seed":"atlas-northstar-sterling","demo_case":"approval_required_discount"}'),
  ('30000000-0000-4000-8000-000000000003', 'Margin floor blocking demo discount', 'Blocks discounts that would drive Sterling installation-package margin below the configured floor.', 'percent_off', 500, 2500, 0, '2026-01-01', null, true, '{"customer_external_id":"DEMO-CUST-STERLING","sku":"INST-PKG","block_when_margin_below_floor":true}', 6500, '{"demo_seed":"atlas-northstar-sterling","demo_case":"margin_floor_block"}'),
  ('30000000-0000-4000-8000-000000000004', 'HX-500 replacement substitution', 'Allows HX-500R to be proposed when HX-500 inventory cannot cover requested demand.', 'amount_off', 0, 0, 250.00, '2026-07-01', '2026-12-31', true, '{"replacement_from":"HX-500","replacement_to":"HX-500R","substitution_requires_customer_acceptance":true}', 2200, '{"demo_seed":"atlas-northstar-sterling","demo_case":"replacement_substitution"}');

commit;
