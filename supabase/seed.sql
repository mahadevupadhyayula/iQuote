-- Demo data for quote workflow scenarios.
-- Safe to re-run: removes only records tagged with metadata.demo_seed = 'atlas-northstar'.

begin;

with demo_products as (
  select id from public.products where metadata ->> 'demo_seed' = 'atlas-northstar'
), demo_customers as (
  select id from public.customers where metadata ->> 'demo_seed' = 'atlas-northstar'
), demo_opportunities as (
  select id from public.opportunities where metadata ->> 'demo_seed' = 'atlas-northstar'
), demo_quotes as (
  select id from public.quotes
  where metadata ->> 'demo_seed' = 'atlas-northstar'
     or customer_id in (select id from demo_customers)
     or opportunity_id in (select id from demo_opportunities)
)
delete from public.workflow_events where quote_id in (select id from demo_quotes);

with demo_products as (
  select id from public.products where metadata ->> 'demo_seed' = 'atlas-northstar'
), demo_customers as (
  select id from public.customers where metadata ->> 'demo_seed' = 'atlas-northstar'
), demo_opportunities as (
  select id from public.opportunities where metadata ->> 'demo_seed' = 'atlas-northstar'
), demo_quotes as (
  select id from public.quotes
  where metadata ->> 'demo_seed' = 'atlas-northstar'
     or customer_id in (select id from demo_customers)
     or opportunity_id in (select id from demo_opportunities)
)
delete from public.approvals where quote_id in (select id from demo_quotes);

with demo_products as (
  select id from public.products where metadata ->> 'demo_seed' = 'atlas-northstar'
), demo_customers as (
  select id from public.customers where metadata ->> 'demo_seed' = 'atlas-northstar'
), demo_opportunities as (
  select id from public.opportunities where metadata ->> 'demo_seed' = 'atlas-northstar'
), demo_quotes as (
  select id from public.quotes
  where metadata ->> 'demo_seed' = 'atlas-northstar'
     or customer_id in (select id from demo_customers)
     or opportunity_id in (select id from demo_opportunities)
)
delete from public.quote_items where quote_id in (select id from demo_quotes) or product_id in (select id from demo_products);

delete from public.quotes where metadata ->> 'demo_seed' = 'atlas-northstar';
delete from public.prices where product_id in (select id from public.products where metadata ->> 'demo_seed' = 'atlas-northstar');
delete from public.inventory where product_id in (select id from public.products where metadata ->> 'demo_seed' = 'atlas-northstar');
delete from public.product_aliases where product_id in (select id from public.products where metadata ->> 'demo_seed' = 'atlas-northstar');
delete from public.discount_policies where metadata ->> 'demo_seed' = 'atlas-northstar';
delete from public.opportunities where metadata ->> 'demo_seed' = 'atlas-northstar';
delete from public.products where metadata ->> 'demo_seed' = 'atlas-northstar';
delete from public.customers where metadata ->> 'demo_seed' = 'atlas-northstar';

insert into public.customers (id, external_id, name, legal_name, domain, billing_email, phone, billing_address, shipping_address, metadata)
values
  ('10000000-0000-4000-8000-000000000001', 'DEMO-CUST-ATLAS', 'Atlas Manufacturing', 'Atlas Manufacturing, Inc.', 'atlas.example', 'ap@atlas.example', '+1-312-555-0142', '{"line1":"2300 Foundry Way","city":"Chicago","region":"IL","postalCode":"60601","country":"US"}', '{"line1":"4100 Assembly Park","city":"Cicero","region":"IL","postalCode":"60804","country":"US"}', '{"demo_seed":"atlas-northstar","segment":"manufacturing"}'),
  ('10000000-0000-4000-8000-000000000002', 'DEMO-CUST-NORTHSTAR', 'Northstar Mining', 'Northstar Mining Ltd.', 'northstar.example', 'procurement@northstar.example', '+1-406-555-0198', '{"line1":"88 Ore Ridge Road","city":"Billings","region":"MT","postalCode":"59101","country":"US"}', '{"line1":"12 Pit Access Road","city":"Butte","region":"MT","postalCode":"59701","country":"US"}', '{"demo_seed":"atlas-northstar","segment":"mining"}');

insert into public.products (id, sku, name, description, status, unit_of_measure, metadata)
values
  ('20000000-0000-4000-8000-000000000200', 'AX-200', 'AX-200 Industrial Actuator', 'Heavy-duty linear actuator for automated production cells.', 'active', 'each', '{"demo_seed":"atlas-northstar","family":"actuators"}'),
  ('20000000-0000-4000-8000-000000000500', 'HX-500', 'HX-500 Hydraulic Pump', 'High-flow hydraulic pump for mining conveyors and crushers.', 'active', 'each', '{"demo_seed":"atlas-northstar","family":"hydraulics"}'),
  ('20000000-0000-4000-8000-000000000600', 'HX-500R', 'HX-500R Hydraulic Pump Replacement Kit', 'Drop-in replacement kit for discontinued HX-500 installations.', 'active', 'each', '{"demo_seed":"atlas-northstar","family":"hydraulics","replaces":"HX-500"}'),
  ('20000000-0000-4000-8000-000000000700', 'INST-STD', 'Standard Installation Service', 'Standard on-site installation and commissioning service.', 'active', 'service', '{"demo_seed":"atlas-northstar","family":"services"}');

insert into public.product_aliases (product_id, alias, source)
values
  ('20000000-0000-4000-8000-000000000200', 'AX200', 'customer_csv'),
  ('20000000-0000-4000-8000-000000000200', 'Atlas actuator 200', 'manual'),
  ('20000000-0000-4000-8000-000000000500', 'HX500', 'customer_csv'),
  ('20000000-0000-4000-8000-000000000500', 'Northstar pump', 'manual'),
  ('20000000-0000-4000-8000-000000000600', 'HX-500 replacement', 'manual'),
  ('20000000-0000-4000-8000-000000000700', 'standard install', 'manual');

insert into public.prices (product_id, currency_code, unit_price, effective_from, effective_to)
values
  ('20000000-0000-4000-8000-000000000200', 'USD', 1280.00, '2026-01-01', null),
  ('20000000-0000-4000-8000-000000000500', 'USD', 3425.00, '2026-01-01', '2026-09-30'),
  ('20000000-0000-4000-8000-000000000600', 'USD', 3195.00, '2026-07-01', null),
  ('20000000-0000-4000-8000-000000000700', 'USD', 650.00, '2026-01-01', null);

insert into public.inventory (product_id, location_code, quantity_on_hand, quantity_reserved, reorder_point)
values
  ('20000000-0000-4000-8000-000000000200', 'CHI-01', 12, 2, 4),
  ('20000000-0000-4000-8000-000000000200', 'DAL-02', 8, 0, 3),
  ('20000000-0000-4000-8000-000000000500', 'DEN-01', 3, 1, 2),
  ('20000000-0000-4000-8000-000000000500', 'SEA-01', 4, 0, 2),
  ('20000000-0000-4000-8000-000000000600', 'DEN-01', 6, 1, 2),
  ('20000000-0000-4000-8000-000000000600', 'SEA-01', 5, 0, 2);

insert into public.discount_policies (id, name, description, policy_type, discount_bps, max_discount_bps, amount_off, starts_on, ends_on, active, metadata)
values
  ('30000000-0000-4000-8000-000000000001', 'Atlas volume discount', 'Manufacturing customers receive 8% off actuator quantities of 10 or more.', 'percent_off', 800, 1200, 0, '2026-01-01', null, true, '{"demo_seed":"atlas-northstar","customer_external_id":"DEMO-CUST-ATLAS","minimum_quantity":10}'),
  ('30000000-0000-4000-8000-000000000002', 'Northstar replacement incentive', 'Mining customers receive a fixed credit when replacing HX-500 with HX-500R.', 'amount_off', 0, 0, 250.00, '2026-07-01', '2026-12-31', true, '{"demo_seed":"atlas-northstar","customer_external_id":"DEMO-CUST-NORTHSTAR","replacement_from":"HX-500","replacement_to":"HX-500R"}'),
  ('30000000-0000-4000-8000-000000000003', 'Standard installation bundle', 'Installation is discounted 15% when bundled with equipment.', 'percent_off', 1500, 1500, 0, '2026-01-01', null, true, '{"demo_seed":"atlas-northstar","sku":"INST-STD","requires_equipment":true}');

commit;
