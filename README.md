# iQuote

iQuote is a Next.js quote workflow demo backed by Supabase and OpenAI. It covers intake, extraction, catalog matching, inventory resolution, approval routing, quote generation, and PDF delivery.

## Prerequisites

- Node.js 20 or newer and npm.
- Docker Desktop or another Docker runtime for local Supabase.
- Supabase CLI installed and available as `supabase`.
- An OpenAI API key for live quote extraction.

## Install dependencies

```bash
npm install
```


## Dependency version policy

This repository uses explicit caret ranges in `package.json` rather than broad tags such as `latest` or fully exact pins. Each dependency must declare a supported baseline version, and npm may resolve compatible non-breaking updates within that package's semver range.

When updating dependencies, keep the framework and tooling stack aligned: Next.js and `eslint-config-next` should move together; React and `react-dom` should stay on the same major; TypeScript, Tailwind CSS, Supabase, the OpenAI SDK, Vitest, and Playwright should be updated only to versions verified by the required checks below. Do not introduce broad version tags (`latest`, `next`, `canary`, `beta`, or `*`) in committed manifests.

## Start Supabase

Start the local Supabase stack:

```bash
npm run supabase:start
```

The Supabase CLI prints the local API URL, anon key, and service role key. Copy those values into `.env.local` as described below.

## Configure environment variables

Create a local environment file:

```bash
cp .env.example .env.local
```

Then update `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_URL`: local Supabase API URL, usually `http://127.0.0.1:54321`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_ANON_KEY`: local anon key from `supabase start`.
- `SUPABASE_SERVICE_ROLE_KEY`: local service role key from `supabase start`.
- `OPENAI_API_KEY`: your OpenAI API key for live extraction.
- `OPENAI_MODEL`: required for live extraction and read only by server-side OpenAI configuration. The `.env.example` value is an operator-selected example default; verify the model is enabled for your OpenAI account before deployment.
- `ENABLE_DEMO_RESET=true`: enables the demo reset API used by Playwright and local walkthroughs.

## Run migrations and seed data

Apply only migrations:

```bash
npm run db:migrate
```

Apply migrations and load `supabase/seed.sql` demo data:

```bash
npm run db:seed
```

Reset the database to a clean migrated and seeded state:

```bash
npm run db:reset
```

The seed is safe to rerun. It removes and recreates only records tagged with `metadata.demo_seed = 'atlas-northstar'`.

## Start the app

```bash
npm run dev
```

Open <http://127.0.0.1:3000> and use the navigation to create or review quotes.

## Reset the demo without resetting the database

With the app running and `ENABLE_DEMO_RESET=true`, refresh only the seeded demo records:

```bash
npm run demo:reset
```

This calls `POST /api/demo/reset`, which deletes and recreates the Atlas/Northstar demo customers, products, prices, inventory, and discount policies.

## PDF rendering

Quote PDFs are rendered server-side without an external PDF runtime dependency. The endpoint prepares a customer-safe quote document model in `lib/pdf/quote-document.tsx`, then `lib/pdf/render-quote-pdf.ts` serializes a minimal PDF 1.4 document directly with built-in Node.js `Buffer` support, Type1 Helvetica fonts, drawing primitives, and escaped text content streams.

This keeps commercial truth deterministic: quote pricing, totals, approval state, and customer-safe line details come from the approved quote view model rather than from an AI or third-party rendering service.

## Tests and checks

Run linting:

```bash
npm run lint
```

Run unit tests:

```bash
npm run test:unit
```

Run all Playwright end-to-end tests:

```bash
npm run test:e2e
```

Run all configured tests:

```bash
npm test
```

Run type checking:

```bash
npm run typecheck
```

Scenario-specific Playwright commands are also available:

```bash
npm run test:e2e:scenario-a
npm run test:e2e:scenario-b
npm run test:e2e:scenario-c
```

## Demo scenario walkthroughs

Before any walkthrough, run:

```bash
npm run supabase:start
cp .env.example .env.local
npm run db:seed
npm run dev
```

Fill `.env.local` with the Supabase keys and `OPENAI_API_KEY` before starting the app. Use `npm run demo:reset` between scenarios if you want a fresh demo state.

### Scenario A: straight-through Atlas quote

1. Go to `/quotes/new`.
2. Enter customer `Atlas Manufacturing`, email `buyer@atlas.example`, domain `atlas.example`, opportunity `Dallas compressor replenishment`, currency `USD`, and valid until `2026-09-15`.
3. Paste this request text:

   ```text
   Atlas Manufacturing needs a customer quote for 4 AX-200 compressors.
   Ship the order to Dallas, Texas by September 15, 2026.
   Requested discount must be 8% or lower.
   Please split fulfillment from Chicago and Houston if one warehouse cannot cover the full order.
   ```

4. Click **Create draft and run extraction**.
5. Open the created quote from `/quotes`, click **Use recommended** for inventory, then click **Generate quote**.
6. Confirm readiness shows requirements complete, inventory resolved, margin within policy, terms accepted, and approved status. The customer PDF endpoint should be available from the quote page.

Automated version:

```bash
npm run test:e2e:scenario-a
```

### Scenario B: discount exception approval

1. Go to `/quotes/new`.
2. Enter customer `Atlas Manufacturing`, email `buyer@atlas.example`, domain `atlas.example`, opportunity `Competitive replacement opportunity`, currency `USD`, and valid until `2026-09-15`.
3. Paste this request text:

   ```text
   Atlas Manufacturing needs a quote for 4 AX-200 compressors.
   Ship the order to Dallas, Texas by September 15, 2026.
   Requested discount is 12%.
   Discount reason: competitive replacement opportunity.
   ```

4. Click **Create draft and run extraction** and open the quote workspace.
5. If needed, set **First-line discount bps** to `1200`, add a correction note, and apply corrections.
6. Click **Use recommended** for inventory, then **Submit for approval**.
7. Open the product manager approval, set **Modified discount (bps)** to `1000`, add comments, and click **Approve modified**.
8. Return to the quote and click **Generate quote**. Confirm totals changed and readiness is complete.

Automated version:

```bash
npm run test:e2e:scenario-b
```

### Scenario C: inventory exception resolution

1. Go to `/quotes/new`.
2. Enter customer `Northstar Mining`, email `procurement@northstar.example`, domain `northstar.example`, opportunity `Butte hydraulic pump replenishment`, currency `USD`, and valid until `2026-09-30`.
3. Paste this request text:

   ```text
   Northstar Mining needs a customer quote for 6 HX-500 hydraulic pumps.
   Ship the order to Butte, Montana by September 30, 2026.
   Requested discount is 0%.
   If one warehouse cannot cover all units, propose split fulfillment, a later delivery date, or a seeded replacement product option.
   ```

4. Click **Create draft and run extraction** and open the quote workspace.
5. Confirm inventory is unresolved, click **Use recommended**, and verify the split fulfillment recommendation across seeded warehouses.
6. Add correction note `confirmed split fulfillment across seeded warehouses`, apply corrections, then click **Generate quote**.
7. Confirm product configuration, pricing, inventory, margin, terms, and approved status are complete.

Automated version:

```bash
npm run test:e2e:scenario-c
```
