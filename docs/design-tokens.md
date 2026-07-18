# Design Tokens

The Intelligent Quote Workspace uses semantic design tokens to keep quote intake, validation, exception handling, generation, and final quote presentation consistent and auditable. Tokens must be consumed through CSS custom properties and Tailwind theme aliases rather than one-off component colors.

## Mockup observations

The five reference mockups in `docs/mockups/` establish a clean enterprise workspace aesthetic:

- **01 Intake**: white cards on a very light cool background, blue primary actions, green high-confidence badges, amber draft/clarification states, and structured upload/input surfaces.
- **02 Review**: dense quote configuration tables, success readiness checks, blue timeline/progress indicators, green recommendation panels, and summary cards.
- **03 Resolve Exceptions**: amber/orange exception panels, destructive red discount over-limit values, disabled muted actions, and high/medium-priority status badges.
- **04 Generate Quote**: larger quote preview paper, approved requirement side cards, primary export actions, and commercial summary areas that separate totals from discounts.
- **05 Final Quote**: document viewer layout with a white quote sheet, subtle border/shadow elevation, blue section accents, green delivery summary, and red discount values.

## Core semantic tokens

All color values are stored as HSL triplets in `app/globals.css` and exposed to Tailwind through `tailwind.config.ts`.

| Token | CSS custom property | Tailwind usage | Intended use |
| --- | --- | --- | --- |
| Background | `--background` | `bg-background` | App canvas and page background. |
| Foreground | `--foreground` | `text-foreground` | Primary text, headings, quote totals. |
| Card | `--card`, `--card-foreground` | `bg-card text-card-foreground` | Panels, sidebars, quote preview surfaces, popovers. |
| Border | `--border` | `border-border` | Card outlines, table dividers, input separators. |
| Input | `--input` | `border-input` | Textareas, search fields, upload drop zones. |
| Primary | `--primary`, `--primary-foreground` | `bg-primary text-primary-foreground` | Main workflow CTAs, active step indicators, links, selected progress states. |
| Secondary | `--secondary`, `--secondary-foreground` | `bg-secondary text-secondary-foreground` | Secondary buttons and low-emphasis filled surfaces. |
| Muted | `--muted`, `--muted-foreground` | `bg-muted text-muted-foreground` | Helper text, disabled surfaces, placeholder metadata, inactive controls. |
| Accent | `--accent`, `--accent-foreground` | `bg-accent text-accent-foreground` | Informational callouts, quote summary panels, hover/selected rows. |
| Success | `--success`, `--success-foreground`, `--success-soft` | `bg-success`, `text-success`, `bg-success-soft` | Readiness checks, valid configuration, inventory success, approved states. |
| Warning | `--warning`, `--warning-foreground`, `--warning-soft` | `bg-warning`, `text-warning`, `bg-warning-soft` | Clarifications, draft badges, SLA urgency, exception panels that are not destructive. |
| Destructive | `--destructive`, `--destructive-foreground`, `--destructive-soft` | `bg-destructive`, `text-destructive`, `bg-destructive-soft` | Policy violations, over-limit discounts, blocked approvals, destructive actions. |
| Focus ring | `--ring` | `ring-ring`, `focus-visible:ring-ring` | Keyboard focus and selected control outlines. |

## Radius tokens

| Token | CSS custom property / Tailwind alias | Intended use |
| --- | --- | --- |
| Large radius | `--radius`, `rounded-lg` | Standard cards, quote document panels, primary controls. |
| Medium radius | `calc(var(--radius) - 2px)`, `rounded-md` | Inputs, table row cards, badges with larger hit areas. |
| Small radius | `calc(var(--radius) - 4px)`, `rounded-sm` | Compact badges, thumbnails, small controls. |

## Shadows and elevation

| Token | CSS custom property | Tailwind usage | Intended use |
| --- | --- | --- | --- |
| Card shadow | `--shadow-card` | `shadow-card` | Default panel elevation in intake, review, exception, and generation screens. |
| Enterprise shadow | `--shadow-enterprise` | `shadow-enterprise` | Raised workspace panels and floating toolbars. |
| Enterprise large shadow | `--shadow-enterprise-lg` | `shadow-enterprise-lg` | Quote preview sheet, final quote document, and high-emphasis overlays. |

## Spacing and layout density

Spacing tokens describe density rather than fixed component decisions. Use them with Tailwind arbitrary values, for example `p-[var(--spacing-card)]` or `gap-[var(--spacing-grid)]`.

| Token | CSS custom property | Intended use |
| --- | --- | --- |
| Page padding | `--spacing-page` | Outer workspace gutters and document viewer padding. |
| Grid gap | `--spacing-grid` | Gaps between intake/review sidebars, main work area, and readiness panels. |
| Card padding | `--spacing-card` | Standard panel padding. |
| Control gap | `--spacing-control` | Button groups, badge/icon spacing, form control clusters. |
| Dense gap | `--spacing-dense` | Table rows, checklist items, compact metadata. |
| Workspace max width | `--layout-workspace-max` | Full workflow shell width. |
| Document max width | `--layout-document-max` | Final quote/PDF preview sheet width. |
| Sidebar width | `--layout-sidebar` | Left and right workflow sidebars. |

## Status badge tokens

Status badge tokens are semantic combinations of foreground, background, and border colors. They should be used for confidence, workflow state, readiness, SLA, priority, and exception badges.

| Badge | CSS custom properties | Intended use |
| --- | --- | --- |
| Success badge | `--badge-success`, `--badge-success-foreground`, `--badge-success-border` | High confidence, approved, ready, recommended, valid. |
| Warning badge | `--badge-warning`, `--badge-warning-foreground`, `--badge-warning-border` | Draft, low confidence, needs clarification, medium priority. |
| Destructive badge | `--badge-destructive`, `--badge-destructive-foreground`, `--badge-destructive-border` | High priority, blocked, policy exceeded, approval required. |
| Info badge | `--badge-info`, `--badge-info-foreground`, `--badge-info-border` | Informational IDs, quote summary labels, neutral workflow markers. |
| Muted badge | `--badge-muted`, `--badge-muted-foreground`, `--badge-muted-border` | Optional, inactive, disabled, secondary metadata. |

Tailwind exposes these as `bg-badge-*`, `text-badge-*-foreground`, and `border-badge-*-border`.

## Component usage by screen

### Intake

- Use `bg-background` for the workspace canvas and `bg-card text-card-foreground border-border shadow-card` for the request, extraction preview, checklist, SLA, and activity panels.
- Use `border-input focus-visible:ring-ring` for the customer request textarea, search input, and upload drop zone.
- Use `bg-primary text-primary-foreground` for the active step and “Extract and Build Quote” CTA.
- Use `bg-badge-success text-badge-success-foreground border-badge-success-border` for high-confidence extracted fields and completed checklist rows.
- Use `bg-badge-warning text-badge-warning-foreground border-badge-warning-border` for draft, low-confidence, missing information, and clarification chips.

### Review

- Use card and border tokens for quote configuration tables, requirements summaries, readiness panels, and quote summary cards.
- Use `text-success` and success badges for valid pricing, inventory, margin, recommendations, and completed timeline events.
- Use `text-destructive` only for commercial values that violate policy or reduce totals, such as discount amounts.
- Use `bg-accent text-accent-foreground` for informational SLA or summary callouts that are not success/warning/destructive states.

### Resolve exceptions

- Use warning soft surfaces and warning badges for clarification exceptions and SLA waiting states.
- Use destructive text/badges for over-limit discounts, approval blockers, or high-priority exceptions.
- Disabled quote-generation actions should use muted foreground/surfaces instead of a custom gray.
- Exception cards should combine `border-warning`-style semantic colors via badge tokens or warning/destructive soft surfaces, preserving clear audit visibility.

### Generate quote

- Use `shadow-enterprise-lg`, `bg-card`, and `border-border` for the quote preview sheet.
- Use success tokens for approved requirements, readiness, delivery confirmation, and discount-within-authority cards.
- Use primary tokens for PDF generation and export CTAs; use bordered secondary controls for download, send, and save actions.
- Quote summaries must render totals with foreground, discounts with destructive, and supporting notes with muted/accent tokens.

### Final quote

- Use `bg-background` for the viewer canvas and `bg-card shadow-enterprise-lg border-border` for the final quote document.
- Use primary/accent tokens for section labels, icons, and viewer controls.
- Use success soft surfaces for delivery summary and destructive text for discounts.
- Keep the document presentation tokenized so PDF and browser preview remain visually aligned without hardcoded component colors.

## Implementation rules

- Add new semantic values to `app/globals.css` and expose them in `tailwind.config.ts` before using them in components.
- Do not hardcode one-off colors in workflow components.
- Do not use color to imply commercial truth. Pricing, discounts, approval status, inventory, totals, and readiness must come from deterministic services and adapters; tokens only communicate already-determined state.
