import { describe, expect, it } from "vitest";

import { getMissingFieldDefinition, normalizeMissingFieldPath, requiredFieldsStillMissing } from "@/lib/rules/missing-information-rules";

describe("missing information rules", () => {
  it("normalizes dotted requested item paths", () => {
    expect(normalizeMissingFieldPath("requested_items.0.quantity")).toBe("requested_items[0].quantity");
    expect(getMissingFieldDefinition("requested_items.0.quantity")).toMatchObject({ registryKey: "requested_items[].quantity", itemIndex: 0, control: "number" });
  });

  it("requires only incomplete required missing fields", () => {
    expect(requiredFieldsStillMissing(["requested_items[0].quantity", "delivery_location", "special_requirements"], { "requested_items[0].quantity": 2, delivery_location: "Dallas", special_requirements: "" })).toEqual({});
    expect(requiredFieldsStillMissing(["requested_items[0].quantity", "delivery_location"], { "requested_items[0].quantity": "", delivery_location: "Dallas" })).toEqual({ "requested_items[0].quantity": "Quantity is required." });
  });
});
