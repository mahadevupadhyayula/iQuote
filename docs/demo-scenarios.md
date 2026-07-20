# Demo scenario contracts

These contracts pin the seeded Atlas/Northstar demo flow to deterministic business results. They reference seeded IDs from `supabase/seed.sql`, use integer cents for money, and use basis points for discounts and margins.

The executable source of truth is `lib/demo/scenario-contracts.ts`; this document summarizes the contract for reviewers and demo operators.

## Playwright coverage

- Scenario A: `tests/e2e/scenario-a-straight-through.spec.ts`
- Scenario B: `tests/e2e/scenario-b-discount-exception.spec.ts`
- Scenario C: `tests/e2e/scenario-c-inventory-exception.spec.ts`

## Scenario A — straight-through Atlas Manufacturing quote

- Customer: `10000000-0000-4000-8000-000000000001` / `DEMO-CUST-ATLAS` / Atlas Manufacturing.
- Input line: `AX-200`, quantity `4`, requested discount `800` bps.
- Expected product match: exact SKU match to product `20000000-0000-4000-8000-000000000200` (`AX-200`) with confidence `10000` bps.
- Expected price: list price `128000` cents USD, effective from `2026-01-01`, no end date.
- Expected inventory decision: `single_warehouse`, not blocked, `18` total available, fulfilled from `CHI-01` with quantity `4` of `10` available.
- Expected discount decision: `800` bps requested and approved; approval requirement `straight_through`.
- Expected approval path: `straight_through`.
- Expected quote status path: `draft` → `approved` → `sent`.
- Expected readiness result: `ready`, with no blockers.
- Expected final totals: subtotal `512000` cents, discount `40960` cents, total `471040` cents, cost `328000` cents, gross profit `143040` cents, gross margin `3037` bps.

## Scenario B — Atlas Manufacturing discount exception approval

- Customer: `10000000-0000-4000-8000-000000000001` / `DEMO-CUST-ATLAS` / Atlas Manufacturing.
- Input line: `AX-200`, quantity `4`, requested discount `1200` bps, approved modified discount `1000` bps.
- Expected product match: exact SKU match to product `20000000-0000-4000-8000-000000000200` (`AX-200`) with confidence `10000` bps.
- Expected price: list price `128000` cents USD, effective from `2026-01-01`, no end date.
- Expected inventory decision: `single_warehouse`, not blocked, `18` total available, fulfilled from `CHI-01` with quantity `4` of `10` available.
- Expected discount decision: `1200` bps requested, `1000` bps approved; approval requirement `product_manager`.
- Expected approval path: submit for product manager approval, then approve modified discount at `1000` bps.
- Expected quote status path: `draft` → `pending_approval` → `approved` → `sent`.
- Expected readiness result: `ready`, with no blockers after approval.
- Expected final totals after modified approval: subtotal `512000` cents, discount `51200` cents, total `460800` cents, cost `328000` cents, gross profit `132800` cents, gross margin `2882` bps.

## Scenario C — Northstar Mining inventory exception resolution

- Customer: `10000000-0000-4000-8000-000000000002` / `DEMO-CUST-NORTHSTAR` / Northstar Mining.
- Input line: `HX-500`, quantity `6`, requested discount `0` bps.
- Expected product match: exact SKU match to product `20000000-0000-4000-8000-000000000500` (`HX-500`) with confidence `10000` bps.
- Expected price: list price `342500` cents USD, effective from `2026-01-01` through `2026-09-30`.
- Expected inventory decision: `split_fulfillment`, not blocked, `6` total available, fulfilled from `SEA-01` with quantity `4` of `4` available and `DEN-01` with quantity `2` of `2` available.
- Expected discount decision: `0` bps requested and approved; approval requirement `straight_through`.
- Expected approval path: straight-through after inventory resolution.
- Expected quote status path: `draft` → `needs_information` → `configuring` → `approved` → `sent`.
- Expected readiness result: `ready`, with no blockers after split fulfillment is saved.
- Expected final totals: subtotal `2055000` cents, discount `0` cents, total `2055000` cents, cost `0` cents, gross profit `2055000` cents, gross margin `10000` bps.
