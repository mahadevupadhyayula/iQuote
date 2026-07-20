import { describe, expect, it } from "vitest";

import { getQuoteQueueActionLabel, getQuoteStageRouteDecision } from "@/lib/rules/quote-stage-routing";

describe("quote stage routing", () => {
  it.each([
    ["draft", "/quotes/quote-1/intake"],
    ["needs_information", "/quotes/quote-1/review"],
    ["reviewing", "/quotes/quote-1/review"],
    ["configuring", "/quotes/quote-1/configure"],
    ["pending_approval", "/quotes/quote-1/approval-pending"],
    ["approved", "/quotes/quote-1/generate"],
    ["sent", "/quotes/quote-1/sent"],
    ["accepted", "/quotes/quote-1/sent"],
    ["rejected", "/quotes/quote-1/configure?rejected=true"],
    ["expired", "/quotes/quote-1/configure?expired=true"],
  ] as const)("redirects %s quotes to %s", (status, href) => {
    expect(getQuoteStageRouteDecision("quote-1", status)).toEqual({ kind: "redirect", href });
  });

  it.each([
    ["extracting", "extracting"],
    ["cancelled", "cancelled"],
  ] as const)("renders a lightweight state for %s quotes", (status, state) => {
    expect(getQuoteStageRouteDecision("quote-1", status)).toEqual({ kind: "render", state });
  });
});

describe("quote queue labels", () => {
  it.each([
    ["needs_information", "Review information"],
    ["reviewing", "Review information"],
    ["configuring", "Configure quote"],
    ["pending_approval", "View approval status"],
    ["approved", "Generate quote"],
    ["sent", "View sent quote"],
  ] as const)("labels %s quotes as %s", (status, label) => {
    expect(getQuoteQueueActionLabel(status)).toBe(label);
  });
});
