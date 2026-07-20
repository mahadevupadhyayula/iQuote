# Phase 1 seed data demo scenarios

This document reconciles the Phase 1 Atlas/Northstar demo scenario expectations to the deterministic seed rows in `supabase/seed.sql` and the executable scenario contracts in `lib/demo/scenario-contracts.ts`.

Money is expressed as integer cents. Discounts and gross margin are expressed as basis points (bps) to avoid floating-point ambiguity. Each scenario uses list pricing because the seed rows create list prices only; no customer-specific or customer-tier price rows are seeded.

## Seeded source rows used

| Data type | Seeded rows |
| --- | --- |
| Customers | `DEMO-CUST-ATLAS` / Atlas Manufacturing; `DEMO-CUST-NORTHSTAR` / Northstar Mining |
| Products | `AX-200`, `HX-500`, `HX-500R`, `INST-STD` |
| Prices | `AX-200` = `128000` cents; `HX-500` = `342500` cents; `HX-500R` = `319500` cents; `INST-STD` = `65000` cents |
| Inventory | `AX-200`: `CHI-01` has `10` available, `DAL-02` has `8` available; `HX-500`: `DEN-01` has `2` available, `SEA-01` has `4` available; `HX-500R`: `DEN-01` has `5` available, `SEA-01` has `5` available |
| Discount policies | Atlas volume discount: `800` bps, max `1200` bps, minimum quantity `10`; Northstar replacement incentive: `25000` cents amount off for `HX-500` to `HX-500R`; Standard installation bundle: `1500` bps |

## Scenario A — straight-through Atlas Manufacturing quote

| Field | Expected value |
| --- | --- |
| Customer | Atlas Manufacturing (`10000000-0000-4000-8000-000000000001`, `DEMO-CUST-ATLAS`) |
| Requested products and quantities | `AX-200 compressors`, quantity `4` |
| Resolved SKU or replacement SKU | Resolved SKU `AX-200` (`20000000-0000-4000-8000-000000000200`); no replacement SKU |
| Price source chosen | list |
| Unit price | `128000` cents |
| Unit cost | `82000` cents |
| Quantity | `4` |
| Line subtotal | `512000` cents (`128000 * 4`) |
| Discount policy applied | Requested and approved discount `800` bps; straight-through approval. Seeded Atlas volume discount is `800` bps but has minimum quantity `10`, so this scenario records the explicit requested discount from the contract rather than an automatic seed policy entitlement. |
| Discount amount | `40960` cents (`512000 * 800 / 10000`) |
| Net line total | `471040` cents (`512000 - 40960`) |
| Extended cost | `328000` cents (`82000 * 4`) |
| Gross profit | `143040` cents (`471040 - 328000`) |
| Gross margin percentage or basis points | `3037` bps (`round(143040 * 10000 / 471040)`) |
| Inventory source warehouse allocation | `CHI-01`: quantity `4` from `10` available; `single_warehouse`; total available `18` |
| Approval result | `straight_through`; no required approval role |
| Expected persisted quote status | `sent` after status path `draft` → `approved` → `sent` |
| Expected workflow event | `straight_through` |

## Scenario B — Atlas Manufacturing discount exception approval

| Field | Expected value |
| --- | --- |
| Customer | Atlas Manufacturing (`10000000-0000-4000-8000-000000000001`, `DEMO-CUST-ATLAS`) |
| Requested products and quantities | `AX-200 compressors`, quantity `4` |
| Resolved SKU or replacement SKU | Resolved SKU `AX-200` (`20000000-0000-4000-8000-000000000200`); no replacement SKU |
| Price source chosen | list |
| Unit price | `128000` cents |
| Unit cost | `82000` cents |
| Quantity | `4` |
| Line subtotal | `512000` cents (`128000 * 4`) |
| Discount policy applied | Requested discount `1200` bps; product-manager approval required; modified approved discount `1000` bps. The seeded Atlas volume policy has max `1200` bps and minimum quantity `10`, while this scenario quantity is `4`, so the exception is handled through approval. |
| Discount amount | `51200` cents (`512000 * 1000 / 10000`) |
| Net line total | `460800` cents (`512000 - 51200`) |
| Extended cost | `328000` cents (`82000 * 4`) |
| Gross profit | `132800` cents (`460800 - 328000`) |
| Gross margin percentage or basis points | `2882` bps (`round(132800 * 10000 / 460800)`) |
| Inventory source warehouse allocation | `CHI-01`: quantity `4` from `10` available; `single_warehouse`; total available `18` |
| Approval result | Product manager approval required and approved with modified discount `1000` bps |
| Expected persisted quote status | `sent` after status path `draft` → `pending_approval` → `approved` → `sent` |
| Expected workflow event | `submit_for_product_manager_approval`, then `approve_modified_discount_1000_bps` |

## Scenario C — Northstar Mining inventory exception resolution

| Field | Expected value |
| --- | --- |
| Customer | Northstar Mining (`10000000-0000-4000-8000-000000000002`, `DEMO-CUST-NORTHSTAR`) |
| Requested products and quantities | `HX-500 hydraulic pumps`, quantity `6` |
| Resolved SKU or replacement SKU | Resolved SKU `HX-500` (`20000000-0000-4000-8000-000000000500`); no replacement SKU in the persisted scenario contract. Seed data also includes replacement SKU `HX-500R`, but this scenario resolves the requested SKU through split fulfillment of seeded `HX-500` inventory. |
| Price source chosen | list |
| Unit price | `342500` cents |
| Unit cost | `0` cents |
| Quantity | `6` |
| Line subtotal | `2055000` cents (`342500 * 6`) |
| Discount policy applied | Requested and approved discount `0` bps; straight-through approval. Seeded Northstar replacement incentive is `25000` cents for replacing `HX-500` with `HX-500R`, but this scenario does not persist a replacement SKU or apply that incentive. |
| Discount amount | `0` cents |
| Net line total | `2055000` cents (`2055000 - 0`) |
| Extended cost | `0` cents (`0 * 6`) |
| Gross profit | `2055000` cents (`2055000 - 0`) |
| Gross margin percentage or basis points | `10000` bps (`2055000 * 10000 / 2055000`) |
| Inventory source warehouse allocation | `SEA-01`: quantity `4` from `4` available; `DEN-01`: quantity `2` from `2` available; `split_fulfillment`; total available `6` |
| Approval result | `straight_through` after inventory resolution; no required approval role |
| Expected persisted quote status | `sent` after status path `draft` → `needs_information` → `configuring` → `approved` → `sent` |
| Expected workflow event | `straight_through_after_inventory_resolution` |
