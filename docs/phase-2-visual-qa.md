# Phase 2 Visual QA Checklist

Use this checklist to manually compare the Phase 2 implementation against the quote-workspace mockups. The goal is to verify that the application preserves the Intelligent Quote Workspace product purpose: a controlled, auditable, commercially safe quote workflow rather than a generic chat or autonomous-agent interface.

## Mockups under review

Complete this checklist for each of these four Phase 2 mockups:

- `docs/mockups/01-intake.png`
- `docs/mockups/02-review.png`
- `docs/mockups/03-resolve-exceptions.png`
- `docs/mockups/04-generate-quote.png`

`docs/mockups/05-final-quote.png` is treated as downstream final-quote reference material and is not part of this Phase 2 four-screen visual acceptance pass unless a later task explicitly adds it to scope.

## Viewports and capture requirements

Review every in-scope mockup at the following breakpoints:

- Desktop: `1440 x 1024` or wider, with the workspace content centered and constrained as designed.
- Tablet: `768 x 1024`, verifying that rails, tables, and action panels remain usable after responsive stacking or horizontal overflow.
- Mobile: `390 x 844`, verifying compact header behavior, stepper usability, stacked cards, readable table alternatives, and reachable primary actions.

For each page and breakpoint, capture a screenshot from a stable seeded/demo state. Use the same browser, zoom level, font rendering settings, and seeded data across comparison runs when possible.

## Acceptable screenshot-diff tolerance

Automated or manual screenshot comparisons should use these tolerances:

- Overall image difference should be `<= 0.5%` for stable desktop captures where seeded content exactly matches the mockup.
- Component-local differences on core shell, panels, badges, and tables should be `<= 1.0%` when text wrapping or browser font rasterization causes minor variation.
- Responsive tablet and mobile captures may differ from desktop-only mockups when the layout intentionally stacks or collapses; reviewers should judge those captures against the responsive requirements in this checklist rather than requiring pixel parity with desktop mockups.
- Differences caused by dynamic timestamps, SLA countdown values, seeded user names, avatar imagery, or non-production placeholder imagery are acceptable only when the spacing, hierarchy, status semantics, and action availability remain visually aligned.
- Any difference that changes commercial meaning, readiness state, approval status, quote totals, discount state, inventory state, or disabled/enabled behavior is not acceptable, regardless of pixel-diff percentage.

## Known intentional deviations

Record any intentional deviations discovered during implementation review here before sign-off:

- Mobile and tablet layouts are expected to adapt from the desktop mockups because the supplied mockups are desktop-oriented.
- Dynamic SLA timer values and relative timestamps may differ from the mockups as long as the state color, urgency treatment, and accessible text match the intended state.
- Avatar photographs, uploaded attachment thumbnails, and product placeholder imagery may differ if production-safe assets are not available.
- Browser font antialiasing may cause minor text-rendering differences within the screenshot-diff tolerance.
- If no additional intentional deviations are present for a screen, mark that screen as `No additional intentional deviations` in the review notes.

## Shared review checklist

For each of the four mockups, complete the sections below.

### 1. Header comparison

- [ ] Logo mark, product name, and workspace identity match the mockup hierarchy.
- [ ] Search control position, placeholder, keyboard hint, and visibility match desktop expectations.
- [ ] Utility icons, avatar/user affordance, spacing, and focus states are visually consistent.
- [ ] Tablet and mobile header behavior remains compact without hiding required workflow context.
- [ ] Header controls are not presented as autonomous-agent entry points or generic chat controls.

### 2. Stepper state comparison

- [ ] Step labels and order match the quote workflow: Intake, Review, Resolve Exceptions, Generate Quote.
- [ ] Active, completed, inactive, blocked, and disabled visual states match the current page state.
- [ ] Connector lines, checkmarks, current-step emphasis, and spacing match the mockup at desktop width.
- [ ] Tablet and mobile stepper presentation remains understandable and keyboard accessible.
- [ ] Stepper state reflects workflow data only; it does not imply a transition that has not occurred through the workflow service.

### 3. Three-column layout comparison

- [ ] Desktop layout uses the expected left context rail, central work surface, and right readiness/action rail.
- [ ] Column widths, gaps, card alignment, and vertical rhythm match the relevant mockup.
- [ ] Tablet layout stacks or reflows rails without making tables, cards, or actions unusable.
- [ ] Mobile layout stacks content in a logical task order with primary actions easy to find.
- [ ] Overflow behavior is intentional and does not obscure commercial data or required controls.

### 4. Card density comparison

- [ ] Card padding, border color, radius, elevation, and background treatment match the mockup family.
- [ ] Section headings use consistent icon, title, subtitle, and action placement.
- [ ] Row heights, table density, metadata spacing, and summary metric spacing match the mockup.
- [ ] Tablet and mobile cards remain readable without excessive whitespace or cramped content.
- [ ] Dense commercial sections still show enough context to support auditability.

### 5. Badge color comparison

- [ ] Confidence, readiness, priority, policy, inventory, approval, and exception badges use the intended semantic colors.
- [ ] Badge labels match the state shown in the mockup and do not rely on color alone.
- [ ] Warning, error, success, neutral, and disabled treatments are visually distinct.
- [ ] Badge colors remain legible in desktop, tablet, and mobile screenshots.
- [ ] Badge semantics are display-only and do not generate or alter commercial truth.

### 6. SLA timer comparison

- [ ] SLA timer card placement, icon treatment, label hierarchy, and countdown emphasis match the mockup.
- [ ] Timer state color corresponds to the expected urgency or blocked state.
- [ ] Dynamic timer text is visually stable enough for screenshot review or explicitly masked/recorded.
- [ ] Tablet and mobile timer placement remains visible near related actions or readiness context.
- [ ] Timer text communicates status without changing approval, quote, or workflow truth on its own.

### 7. Readiness checklist comparison

- [ ] Checklist item labels, status icons, progress/readiness indicators, and section ordering match the mockup.
- [ ] Complete, incomplete, warning, blocked, and disabled checklist states are visually distinct.
- [ ] Checklist rows retain readable supporting text and status labels at tablet and mobile widths.
- [ ] Readiness content reflects deterministic service/rule output rather than UI-generated decisions.
- [ ] Primary action enablement agrees with the readiness checklist state.

### 8. Timeline comparison

- [ ] Activity or workflow timeline placement matches the relevant mockup, especially Review and Resolve Exceptions.
- [ ] Event icons, connector lines, timestamps, actor labels, and status text match the intended hierarchy.
- [ ] Timeline wraps, scrolls, or stacks cleanly on tablet and mobile.
- [ ] Dynamic timestamps are acceptable only within the documented tolerance and do not change event meaning.
- [ ] Timeline entries support auditability and avoid implying actions that did not occur.

### 9. Disabled/error state comparison

- [ ] Disabled buttons, blocked quote generation, exception warnings, and validation errors match mockup state styling.
- [ ] Error and disabled states include visible reason text, not just muted color or disabled controls.
- [ ] Destructive, warning, and blocked states are differentiated from neutral unavailable states.
- [ ] Tablet and mobile screenshots preserve the reason text near the disabled or error control.
- [ ] Disabled/enabled state never conflicts with deterministic workflow, approval, pricing, or inventory rules.

### 10. Responsive review

- [ ] Desktop screenshot aligns with the corresponding mockup within the documented tolerance.
- [ ] Tablet screenshot preserves workflow order, panel hierarchy, table usability, and right-rail actions after reflow.
- [ ] Mobile screenshot preserves header context, stepper state, card readability, readiness/actions, and audit timeline access.
- [ ] No content overlaps, truncates critical commercial values, or hides required status explanations.
- [ ] Keyboard focus, touch target sizing, and visible focus treatment are acceptable at every breakpoint.

## Per-mockup sign-off matrix

| Mockup | Desktop reviewed | Tablet reviewed | Mobile reviewed | Screenshot diff within tolerance | Intentional deviations documented | Reviewer notes |
| --- | --- | --- | --- | --- | --- | --- |
| `docs/mockups/01-intake.png` | [ ] | [ ] | [ ] | [ ] | [ ] | |
| `docs/mockups/02-review.png` | [ ] | [ ] | [ ] | [ ] | [ ] | |
| `docs/mockups/03-resolve-exceptions.png` | [ ] | [ ] | [ ] | [ ] | [ ] | |
| `docs/mockups/04-generate-quote.png` | [ ] | [ ] | [ ] | [ ] | [ ] | |

## Final sign-off

- [ ] Header comparison completed for all four mockups.
- [ ] Stepper state comparison completed for all four mockups.
- [ ] Three-column layout comparison completed for all four mockups.
- [ ] Card density comparison completed for all four mockups.
- [ ] Badge color comparison completed for all four mockups.
- [ ] SLA timer comparison completed for all four mockups.
- [ ] Readiness checklist comparison completed for all four mockups.
- [ ] Timeline comparison completed for all four mockups.
- [ ] Disabled/error state comparison completed for all four mockups.
- [ ] Desktop, tablet, and mobile responsive review completed for all four mockups.
- [ ] All known intentional deviations are documented or explicitly marked as none.
