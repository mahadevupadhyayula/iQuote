# AGENTS.md

## Project Purpose

This project is the **Intelligent Quote Workspace**. It is not a generic AI chat app.

All product, architecture, and implementation decisions should preserve the purpose of helping users work with quotes in a controlled, auditable, commercially safe workflow.

## Architectural Boundaries

Follow these boundaries when adding or changing code:

- App Router routes belong in `app/`.
- UI components belong in `components/`.
- Schemas belong in `lib/schemas/`.
- Deterministic business rules belong in `lib/rules/`.
- Workflow transitions must happen only through `lib/services/workflow-service.ts`.
- External systems must be accessed behind adapter interfaces defined in `lib/adapters/interfaces.ts`.

## Explicit Prohibitions

The following are not allowed:

- No autonomous agents.
- No LangChain or LangGraph.
- No AI-generated pricing, discounts, inventory, approval status, quote totals, or commercial truth.
- OpenAI calls must remain server-side.
- The OpenAI model name must come from `OPENAI_MODEL` through the server-side OpenAI configuration helper.
- Production code must not provide a hardcoded OpenAI model fallback; missing `OPENAI_MODEL` must fail clearly in live extraction paths.
- Tests must inject fake OpenAI clients and fake model names instead of relying on live OpenAI access or hardcoded production models.


## Dependency Version Policy

Use explicit caret ranges in `package.json` for application and development dependencies. Do not commit broad tags such as `latest`, `next`, `canary`, `beta`, or `*`.

Dependency updates must keep the supported stack compatible: Next.js and `eslint-config-next` move together, React and `react-dom` stay on the same major version, and TypeScript, Tailwind CSS, Supabase, the OpenAI SDK, Vitest, and Playwright updates must be validated with the required checks before submission. Prefer focused dependency changes over unrelated upgrades.

## Required Checks

Run these checks before submitting changes:

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`

If a check cannot be run because of an environment limitation, document the limitation clearly. Run `npm run lint` with the other required checks to validate the Next.js and TypeScript ESLint configuration.

## PR Guidance

Pull requests should explain:

- What changed.
- Why the change is needed.
- How the change preserves the Intelligent Quote Workspace product purpose.
- Any architectural boundary that is relevant to the change.
- Any risks, migrations, or follow-up work.

Keep PRs focused. Avoid mixing unrelated refactors with feature or bug-fix work.

## Test Reporting Expectations

In PR descriptions and final handoff notes, report every required check that was run, including the exact command and whether it passed, failed, or could not be completed because of an environment limitation.

For any failed or skipped check, include the reason and any relevant error summary.
