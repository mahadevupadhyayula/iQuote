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

insert into public.opportunities (id, customer_id, external_id, name, stage, expected_close_date, owner_id, currency_code, estimated_amount, metadata)
values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'DEMO-OPP-ATLAS-DALLAS', 'Dallas compressor replenishment', 'proposal', '2026-09-15', null, 'USD', 144000.00, '{"demo_seed":"atlas-northstar-sterling","source_name":"demo_crm_pipeline","source_version":"2026.07.18","demo_scenario":"straight_through"}'),
  ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'DEMO-OPP-NORTHSTAR-BUTTE', 'Butte hydraulic pump replenishment', 'negotiation', '2026-09-30', null, 'USD', 126000.00, '{"demo_seed":"atlas-northstar-sterling","source_name":"demo_crm_pipeline","source_version":"2026.07.18","demo_scenario":"split_inventory"}'),
  ('60000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'DEMO-OPP-STERLING-INSTALL', 'Sterling installation package', 'qualification', '2026-10-15', null, 'USD', 48000.00, '{"demo_seed":"atlas-northstar-sterling","source_name":"demo_crm_pipeline","source_version":"2026.07.18","demo_scenario":"insufficient_inventory"}');

insert into public.products (id, sku, name, description, status, unit_of_measure, metadata)
values
  ('20000000-0000-4000-8000-000000000200', 'AX-200', 'AX-200 Industrial Compressor', 'Heavy-duty industrial compressor for automated production cells.', 'active', 'each', '{"demo_seed":"atlas-northstar-sterling","family":"compressors"}'),
  ('20000000-0000-4000-8000-000000000210', 'AX-200-FKIT', 'AX-200 Compatible Filter Kit', 'Matched spare filter kit for AX-200 compressor equipment.', 'active', 'kit', '{"demo_seed":"atlas-northstar-sterling","family":"filters","compatible_with":"AX-200"}'),
  ('20000000-0000-4000-8000-000000000500', 'HX-500', 'HX-500 Hydraulic Pump', 'High-flow hydraulic pump for mining conveyors and crushers.', 'active', 'each', '{"demo_seed":"atlas-northstar-sterling","family":"hydraulics"}'),
  ('20000000-0000-4000-8000-000000000600', 'HX-500R', 'HX-500R Hydraulic Pump Replacement Kit', 'Drop-in replacement kit for constrained HX-500 demand.', 'active', 'each', '{"demo_seed":"atlas-northstar-sterling","family":"hydraulics","replaces":"HX-500"}'),
  ('20000000-0000-4000-8000-000000000700', 'INST-STD', 'Standard Installation Bundle', 'Standard installation support bundled with configured equipment.', 'active', 'service', '{"demo_seed":"atlas-northstar-sterling","family":"services"}');

insert into public.product_aliases (product_id, alias, source)
values
  ('20000000-0000-4000-8000-000000000200', 'AX200', 'customer_csv'),
  ('20000000-0000-4000-8000-000000000200', 'Atlas compressor 200', 'manual'),
  ('20000000-0000-4000-8000-000000000200', 'AX-200 compressor equipment', 'manual'),
  ('20000000-0000-4000-8000-000000000210', 'AX-200 compatible filter kit', 'manual'),
  ('20000000-0000-4000-8000-000000000210', 'matching spare filters', 'manual'),
  ('20000000-0000-4000-8000-000000000500', 'HX500', 'customer_csv'),
  ('20000000-0000-4000-8000-000000000500', 'Northstar pump', 'manual'),
  ('20000000-0000-4000-8000-000000000600', 'HX-500 replacement', 'manual'),
  ('20000000-0000-4000-8000-000000000700', 'standard installation bundle', 'manual');

-- Warehouse master data is represented by deterministic warehouse codes on inventory rows.
-- CHI-01 = Chicago, DAL-02 = Dallas, SEA-01 = Seattle, DEN-01 = Denver.
insert into public.prices (id, product_id, currency_code, unit_price, effective_from, effective_to, price_type, customer_tier, customer_id, unit_cost, source_name, source_version)
values
  -- List prices for every product.
  ('40000000-0000-4000-8000-000000000201', '20000000-0000-4000-8000-000000000200', 'USD', 1280.00, '2026-01-01', null, 'list', null, null, 820.00, 'demo_erp_pricebook', '2026.07.18'),
  ('40000000-0000-4000-8000-000000000211', '20000000-0000-4000-8000-000000000210', 'USD', 145.00, '2026-01-01', null, 'list', null, null, 75.00, 'demo_erp_pricebook', '2026.07.18'),
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
  -- Atlas demo scenarios: AX-200 has 18 available across seeded warehouses; 19 units triggers fulfillment review.
  ('50000000-0000-4000-8000-000000000201', '20000000-0000-4000-8000-000000000200', 'CHI-01', 12, 2, 4, 'demo_wms_snapshot', now(), now()),
  ('50000000-0000-4000-8000-000000000202', '20000000-0000-4000-8000-000000000200', 'DAL-02', 8, 0, 3, 'demo_wms_snapshot', now(), now()),
  ('50000000-0000-4000-8000-000000000211', '20000000-0000-4000-8000-000000000210', 'DAL-02', 20, 2, 5, 'demo_wms_snapshot', now(), now()),
  -- Split scenario: Northstar HX-500 requires Seattle + Denver for medium demand.
  ('50000000-0000-4000-8000-000000000501', '20000000-0000-4000-8000-000000000500', 'DEN-01', 3, 1, 2, 'demo_wms_snapshot', now(), now()),
  ('50000000-0000-4000-8000-000000000502', '20000000-0000-4000-8000-000000000500', 'SEA-01', 4, 0, 2, 'demo_wms_snapshot', now(), now()),
  ('50000000-0000-4000-8000-000000000503', '20000000-0000-4000-8000-000000000500', 'CHI-01', 1, 0, 1, 'demo_wms_snapshot', now(), now()),
  -- Replacement SKU scenario: HX-500R has enough stock to substitute when HX-500 is short.
  ('50000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000600', 'DEN-01', 6, 1, 2, 'demo_wms_snapshot', now(), now()),
  ('50000000-0000-4000-8000-000000000602', '20000000-0000-4000-8000-000000000600', 'SEA-01', 5, 0, 2, 'demo_wms_snapshot', now(), now()),
  -- Service item inventory rows keep warehouse references deterministic without adding physical stock.
  ('50000000-0000-4000-8000-000000000701', '20000000-0000-4000-8000-000000000700', 'CHI-01', 0, 0, 0, 'demo_services_capacity', now(), now());

insert into public.discount_policies (id, name, description, policy_type, discount_bps, max_discount_bps, amount_off, starts_on, ends_on, active, conditions, minimum_margin_bps, metadata)
values
  ('30000000-0000-4000-8000-000000000001', 'Atlas volume discount', 'Atlas 0% discounts are straight-through; discounts above 8% and through 15% require product-manager approval, including the 12% demo request.', 'percent_off', 800, 1500, 0, '2026-01-01', null, true, '{"customer_external_id":"DEMO-CUST-ATLAS","sku":"AX-200","minimum_quantity":1,"automatic_approval_bps":800,"approval_required_above_bps":800}', 2500, '{"demo_seed":"atlas-northstar-sterling","demo_case":"atlas_discount_threshold"}'),
  ('30000000-0000-4000-8000-000000000002', 'Northstar replacement incentive', 'Mining customers receive a fixed credit when replacing HX-500 with HX-500R.', 'amount_off', 0, 0, 250.00, '2026-07-01', '2026-12-31', true, '{"replacement_from":"HX-500","replacement_to":"HX-500R","substitution_requires_customer_acceptance":true}', 2200, '{"demo_seed":"atlas-northstar-sterling","demo_case":"replacement_substitution"}'),
  ('30000000-0000-4000-8000-000000000003', 'Standard installation bundle', 'Installation is discounted 15% when bundled with equipment.', 'percent_off', 1500, 1500, 0, '2026-01-01', null, true, '{"sku":"INST-STD","requires_equipment":true}', 6500, '{"demo_seed":"atlas-northstar-sterling","demo_case":"installation_bundle"}');

commit;
