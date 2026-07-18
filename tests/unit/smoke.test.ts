import { describe, expect, it } from "vitest";

const normalizeQuoteInput = (value: string) => value.trim().replace(/\s+/g, " ");

describe("quote service rules", () => {
  it("normalizes quote intake text for downstream service tests", () => {
    expect(normalizeQuoteInput("  Capture   ideas worth repeating.  ")).toBe(
      "Capture ideas worth repeating.",
    );
  });
});
