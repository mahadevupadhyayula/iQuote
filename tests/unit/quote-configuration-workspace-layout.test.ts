import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "components/quotes/quote-configuration-workspace.tsx",
  "utf8",
);
const actions = readFileSync(
  "components/quotes/quote-workspace-actions.tsx",
  "utf8",
);

describe("quote configuration workspace presentation", () => {
  it("renders exactly four primary cards in the balanced configuration grid", () => {
    expect(source).toContain('data-configuration-grid="true"');
    expect(source).toContain("lg:grid-cols-12");
    expect(source).toContain('data-primary-card="true"');
    expect(source.match(/<PrimaryCard\s+title=/g)).toHaveLength(4);
    expect(source).toContain('title="Requirements"');
    expect(source).toContain('title="Quote Configuration"');
    expect(source).toContain('title="Quote Summary"');
    expect(source).toContain('title="SLA"');
    expect(source).toContain('className="order-1 lg:col-span-4"');
    expect(source).toContain('className="order-2 lg:col-span-8"');
    expect(source).toContain('className="order-3 lg:order-4 lg:col-span-8"');
    expect(source).toContain('className="order-4 lg:order-3 lg:col-span-4"');
  });

  it("does not render removed standalone configuration-page sections", () => {
    expect(source).not.toContain("ExceptionCards");
    expect(source).not.toContain("Exception summary");
    expect(source).not.toContain("Inventory Recommendation</CardTitle>");
    expect(source).not.toContain("Quote Readiness");
    expect(source).not.toContain("Activity Timeline");
    expect(source).not.toContain("<CardTitle>Actions</CardTitle>");
  });

  it("keeps inventory recommendations and pricing resolution inside one quote configuration card", () => {
    expect(source).toContain("function QuoteConfigurationCard");
    expect(source).toContain("<InventoryResolutionSection quote={quote} />");
    expect(source).toContain("<PricingResolutionTable quote={quote} />");
    expect(source).toContain("Inventory resolved");
    expect(source).toContain("quote.configuration.inventoryResolvedCount");
    expect(source).toContain("quote.configuration.inventoryRequiredCount");
    expect(source).toContain(
      "Pricing will resolve after all recommendations are applied.",
    );
    expect(source).toContain("A product match still requires confirmation.");
    expect(source).not.toContain("Pricing resolution is pending.");
    expect(source).toContain("Pricing resolved");
    expect(source).toContain("priceTypeLabel");
    expect(source).toContain("line.priceSource");
  });

  it("derives inventory application and action enablement from backend view-model state", () => {
    expect(actions).toContain(
      "line?.inventoryApplied && line.inventoryConfirmedAt",
    );
    expect(actions).toContain("✓ Applied");
    expect(actions).toContain("router.refresh()");
    expect(actions).toContain("quote.configuration.canContinue");
    expect(actions).toContain("quote.configuration.blockers.map");
    expect(actions).toContain("Complete the remaining quote configuration before continuing.");
    expect(actions).toContain("Configuration complete. Continue will evaluate approval requirements.");
    expect(actions).not.toContain("Apply all inventory recommendations before continuing.");
    expect(actions).not.toContain("Resolve pricing errors before continuing.");
  });
});
