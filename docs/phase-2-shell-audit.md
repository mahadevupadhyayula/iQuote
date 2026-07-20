# Phase 2 Shell Audit

This audit compares the current app shell implementation and reusable UI primitives against the Phase 2 quote-workspace mockups:

- `docs/mockups/01-intake.png`
- `docs/mockups/02-review.png`
- `docs/mockups/03-resolve-exceptions.png`
- `docs/mockups/04-generate-quote.png`

No product behavior changes are proposed here. This document is an implementation audit for the Intelligent Quote Workspace shell and the reusable component surface needed to build the controlled quote workflow screens.

## Existing shell components

### `components/app-shell/app-header.tsx`

Current reusable responsibilities:

- Renders the branded workspace header with the title `Intelligent Quote Workspace`.
- Provides a server-rendered logo mark, desktop search input, notification button, help button, and user menu affordance.
- Uses `Input` from `components/ui/input.tsx` and icon-only buttons with accessible labels.
- Constrains header content to `max-w-[1440px]`, matching the wide desktop mockup canvas.

Fit against mockups:

- The header closely matches all four mockups: logo at left, centered search box, utility icons, avatar, user name, role, and chevron.
- The search control includes a `⌘ K` keyboard hint, which appears in each mockup.
- The header uses hidden responsive states for search and profile text; this is reasonable for smaller breakpoints but the mobile shell is not represented in the supplied mockups.

Gaps to address before implementation:

- The current logo is CSS-generated and approximates the mockup mark; a reusable brand/logo primitive or SVG asset would improve consistency.
- Header action buttons should probably reuse `Button` with `variant="ghost"` and `size="icon"` once the shell is finalized, rather than raw `<button>` elements, to centralize focus and disabled styling.
- There is no mobile search disclosure pattern documented; if smaller layouts are in scope, add an explicit compact header design.

### `components/app-shell/workflow-stepper.tsx`

Current reusable responsibilities:

- Defines the four quote workflow steps: Intake, Review, Resolve Exceptions, and Generate Quote.
- Maps `QuoteStatus` values to a workflow step for current quote state presentation.
- Renders a semantic `nav` with an ordered list and active/completed styling.

Fit against mockups:

- Step labels and order match all four supplied mockups.
- Completed states use check icons, active states use primary blue, and inactive states use bordered circles, which aligns with the later-stage mockups.
- The stepper supports direct `currentStep` override, which is useful for page-specific shell rendering.

Gaps to address before implementation:

- The current stepper uses a grid that collapses to one column on small screens. The mockups only show a wide horizontal stepper, so compact behavior needs an explicit design decision.
- The mockups show active underline/track emphasis across the selected step. The current implementation uses connector lines only at `xl` and does not include the same bottom active rule.
- Completed steps in the mockups include check treatment both inside the circle and beside labels depending on state. The current component only puts a check inside the circle.
- Consider adding `aria-current="step"` on the active item and a screen-reader label for completed steps.

### `components/app-shell/workspace-layout.tsx`

Current reusable responsibilities:

- Composes `AppHeader`, `WorkflowStepper`, and a constrained main content region.
- Applies the global workspace background (`bg-slate-50`) and foreground color.
- Accepts `currentStep` and `status` so route pages can drive the workflow stepper without duplicating shell logic.

Fit against mockups:

- Provides the shared page structure visible in all four mockups: header, workflow navigation, then workspace content.
- The `max-w-[1440px]` content width aligns with the desktop mockup width.
- The shell is compatible with both the three-column workspace states and the quote-preview state.

Gaps to address before implementation:

- The mockups rely on reusable content-region grids: left context rail, central work area, right readiness/summary rail, and bottom activity timeline. Those layout primitives do not exist yet.
- There is no explicit sticky/fixed behavior for side rails or action panels. The mockups imply long desktop pages where right-side actions remain visually prominent.
- The layout has no built-in responsive breakpoints for stacking rails and preserving the workflow stepper on tablet/mobile.

## Existing UI primitives that should be reused

### Current reusable files

The following primitives already exist and should be reused before adding one-off shell styling:

- `components/ui/card.tsx` for bordered, elevated panels and their header/content/footer regions.
- `components/ui/badge.tsx` for confidence, readiness, priority, recommendation, and status chips.
- `components/ui/button.tsx` for primary, secondary, outline, ghost, destructive, success, warning, large, small, and icon actions.
- `components/ui/alert.tsx` for warning, destructive, success, and default callouts.
- `components/ui/input.tsx` for the header search and structured text controls.
- `components/ui/textarea.tsx` for the customer request intake text area.
- `components/ui/table.tsx` for line-item and quote-preview tables.
- `components/ui/separator.tsx` for section rules and panel dividers.
- `components/ui/progress.tsx` for SLA, readiness, or timeline progress if a linear representation is needed.
- `components/ui/dialog.tsx`, `components/ui/select.tsx`, and `components/ui/tooltip.tsx` for overlays, controlled choices, and explanatory labels.

### Reuse recommendations

- Use `Card` for every major mockup panel: customer request, AI extraction preview, checklist/readiness, SLA information, quote configuration, quote summary, inventory snapshot, notes, delivery details, and quote preview.
- Use `Badge` variants for confidence (`success`/`warning`), draft/readiness states, exception priority, and recommendation labels. Add variants only when the existing semantic colors are insufficient.
- Use `Button` for all actions, including icon-only utilities, primary quote actions, secondary draft/download/send actions, and warning/exception actions.
- Use `Alert` for warning blocks such as missing information, exception summaries, and blocked generation states.
- Use design tokens from `app/globals.css` for colors, shadows, spacing, and max-widths rather than introducing unrelated hardcoded values.

## Missing primitives and required new files

The mockups require several reusable components that do not exist yet. To keep Phase 2 implementation focused and auditable, add these as UI or quote-workspace components rather than building them inline in route files.

### Required new app-shell/workspace files

- `components/app-shell/workspace-grid.tsx`  
  Reusable responsive grid for left rail, center work surface, and right rail.
- `components/app-shell/workspace-panel.tsx`  
  Thin wrapper around `Card` for consistent shell panel padding, icon/title/header action layout, and section dividers.
- `components/app-shell/activity-timeline.tsx`  
  Horizontal/stacked workflow event timeline shown in Review and Resolve Exceptions.
- `components/app-shell/readiness-panel.tsx`  
  Shared checklist/readiness panel pattern for Intake, Review, Resolve Exceptions, and Generate Quote.
- `components/app-shell/sla-card.tsx`  
  Consistent SLA card for countdown, status, and link/action presentation.

### Required new quote-workspace files

- `components/quotes/customer-request-card.tsx`  
  Displays pasted customer request, timestamp, copy affordance, and attachment/upload state.
- `components/quotes/requirements-summary-card.tsx`  
  Displays normalized request fields and exception call-to-action.
- `components/quotes/extraction-preview.tsx`  
  Displays AI-extracted fields with confidence badges and per-field expansion affordances.
- `components/quotes/intake-checklist.tsx`  
  Intake-specific checklist rows with success, warning, and incomplete indicators.
- `components/quotes/quote-configuration-table.tsx`  
  Reusable line-item configuration table with item imagery/icon, quantity, price, availability, discount, margin, and row menu affordances.
- `components/quotes/inventory-recommendation-card.tsx`  
  Displays deterministic inventory recommendation details and delivery ETAs.
- `components/quotes/exception-resolution-list.tsx`  
  Lists approval and clarification exceptions, including priority, reason, impact metrics, and allowed actions.
- `components/quotes/quote-summary-card.tsx`  
  Displays subtotal, discount, total, gross margin, projected margin, and policy badges.
- `components/quotes/approved-requirements-card.tsx`  
  Generate Quote left-rail checklist of approved inputs.
- `components/quotes/delivery-details-card.tsx`  
  Displays destination, requested date, ship-from split, and estimated delivery.
- `components/quotes/internal-notes-card.tsx`  
  Displays internal notes and metadata.
- `components/quotes/quote-preview.tsx`  
  Renders the customer-facing quote document preview in Generate Quote.
- `components/quotes/quote-actions-panel.tsx`  
  Encapsulates Generate PDF, Download Quote, Send to Customer, Save Draft, and disabled-state behavior.

### Potential new UI primitives

- `components/ui/status-icon.tsx` for check, warning, error, pending, and neutral icon circles.
- `components/ui/metric-row.tsx` for label/value rows used in summaries and requirement panels.
- `components/ui/dropzone.tsx` for the Intake attachment area.
- `components/ui/icon-callout.tsx` for compact icon-led notices that are less assertive than `Alert`.
- `components/ui/page-section-heading.tsx` for consistent icon/title/action panel headings.

## Visual gaps against supplied mockups

### Shared shell across all mockups

- Header proportions are close, but the mockups use a distinct SVG-style blue ring logo and avatar photo. The current implementation uses CSS-generated shapes and initials.
- The mockups use a very consistent white card surface, subtle blue-tinted border, and soft shadow language. Existing tokens support this, but a panel wrapper should normalize exact padding and elevation.
- The workflow stepper in the mockups has a stronger selected underline and longer connector tracks than the current component.
- Icon styling is highly consistent in the mockups: blue line icons for section headers, green circles for completed checklist items, orange outlines for warnings, and red/orange status for exceptions. A status icon primitive would avoid repetition.

### `01-intake.png`

- Current reusable shell supports the header and four-step workflow, but the three-column Intake layout is not implemented as a reusable grid.
- Required visual pieces include customer request textarea, attachment dropzone, recent activity card, AI extraction field table, confidence badges, suggestions/missing-information callout, intake checklist, SLA card, primary extraction button, and security note.
- Missing information callout is visually warmer and denser than the current generic `Alert`; an `IconCallout` or enhanced `Alert` composition may be needed.
- The extraction preview rows need reusable row layout with icon, field label, extracted value, confidence badge, and row disclosure chevron.

### `02-review.png`

- The Review mockup introduces a left requirement summary, central quote configuration table, inventory recommendation card, right readiness/summary/action rail, and bottom activity timeline.
- `Card`, `Badge`, `Button`, and `Table` can cover the base surfaces, but the quote line-item table needs product thumbnail/icon cells, availability formatting, row menus, and policy-colored metrics.
- Quote summary and readiness appear as reusable right-rail patterns and should not be duplicated per route.
- The bottom activity timeline requires a reusable timeline primitive with horizontal desktop layout and likely stacked mobile behavior.

### `03-resolve-exceptions.png`

- The Resolve Exceptions mockup preserves the Review layout but adds exception cards with priority badges, exception IDs, impact metrics, and action rows.
- Current primitives can support buttons and badges, but no exception-card composition exists.
- The right action rail shows blocked/disabled generation and approval SLA state. Disabled `Button` styles exist, but the panel needs deterministic rules for when generation is unavailable; those rules must remain outside UI components and should flow through existing services/rules.
- Red/orange discount, approval, and warning states need consistent semantic styling across table cells, side rail, and exception cards.

### `04-generate-quote.png`

- The Generate Quote mockup changes the center surface to a customer-facing quote preview document with nested summary cards and terms sections.
- Existing `Card`, `Badge`, `Button`, and `Table` primitives are reusable, but a dedicated `QuotePreview` component is required to prevent route-level duplication.
- The left rail shifts to approved requirements, delivery details, and internal notes; these should be reusable cards rather than bespoke markup.
- The right rail becomes quote readiness, quote summary, policy confirmation, and final actions. A shared `QuoteActionsPanel` should own action layout while route/server actions own behavior.

## Accessibility concerns

- Add `aria-current="step"` to the active workflow step and include accessible text for completed states in the stepper.
- Ensure icon-only controls in header, row menus, copy buttons, upload controls, and quote actions have descriptive labels.
- Do not rely on color alone for confidence, warning, exception, disabled, or approval states; pair iconography with visible text.
- Ensure checklist/readiness rows expose meaningful status text to screen readers, not only check icons.
- The attachment dropzone must have a keyboard-accessible file input and visible focus state.
- Exception actions must have deterministic labels that describe the decision path, such as sending for approval or revising discount.
- Quote-preview document headings should follow a logical heading order and table headers should use semantic table markup.
- SLA countdowns should not update in a way that disrupts screen readers; use polite announcements only for meaningful threshold changes.
- Disabled quote-generation actions should communicate why the action is unavailable.

## Responsive layout assumptions

- Supplied mockups appear to represent a desktop width near 1440 px. The current shell max width matches this assumption.
- Desktop implementation should use a three-column workspace grid: narrow left rail, flexible center work area, and right action/readiness rail.
- At tablet widths, side rails should stack above or below the main work area rather than shrinking table content below usable widths.
- At mobile widths, the workflow stepper should become compact, likely a horizontal scroll step list or current-step summary with disclosure.
- Header search is currently hidden below `md`; a mobile search affordance should be specified before implementing narrow layouts.
- Tables in Review, Resolve Exceptions, and Generate Quote should either become horizontally scrollable within their cards or convert to stacked item cards.
- Right-rail quote actions should remain easy to reach on small screens, potentially as a sticky bottom action bar after accessibility review.

## Product and architecture notes

- The shell should continue to frame quote work as a controlled, auditable workflow rather than a generic chat interface.
- UI components should only display commercial data and allowed actions supplied by services/rules. They must not generate pricing, discounts, approval status, quote totals, or commercial truth.
- Workflow transitions should continue to happen only through `lib/services/workflow-service.ts`.
- External system details, including pricing, inventory, and document/PDF generation, should remain behind adapters and server-side boundaries where applicable.
