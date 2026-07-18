import { describe, expect, it } from "vitest";

import { evaluateInventory, type InventoryRuleProduct, type InventoryRuleRecord } from "@/lib/rules/inventory-rules";
import { createInventoryService } from "@/lib/services/inventory-service";

const now = "2026-07-18T12:00:00.000Z";

const product: InventoryRuleProduct = {
  id: "prod-hx-500",
  sku: "HX-500",
  name: "HX-500 Hydraulic Pump",
  status: "active",
  metadata: { demo_seed: "atlas-northstar" },
};

const replacement: InventoryRuleProduct = {
  id: "prod-hx-500r",
  sku: "HX-500R",
  name: "HX-500R Hydraulic Pump Replacement Kit",
  status: "active",
  metadata: { demo_seed: "atlas-northstar", replaces: "HX-500" },
};

const inventory = (overrides: Partial<InventoryRuleRecord>): InventoryRuleRecord => ({
  productId: product.id,
  locationCode: "DEN-01",
  quantityOnHand: 0,
  quantityReserved: 0,
  reorderPoint: 2,
  updatedAt: "2026-07-18T08:00:00.000Z",
  ...overrides,
});

describe("inventory rules", () => {
  it("fulfills available inventory from one warehouse", () => {
    const result = evaluateInventory({
      product,
      quantity: 3,
      now,
      inventory: [
        inventory({ locationCode: "DEN-01", quantityOnHand: 5, quantityReserved: 1 }),
        inventory({ locationCode: "SEA-01", quantityOnHand: 2, quantityReserved: 0 }),
      ],
    });

    expect(result.status).toBe("single_warehouse");
    expect(result.blocked).toBe(false);
    expect(result.availableQuantity).toBe(6);
    expect(result.fulfillment).toEqual([{ productId: product.id, locationCode: "DEN-01", quantity: 3, availableQuantity: 4 }]);
  });

  it("handles scenario A split fulfillment across seeded warehouses", () => {
    const result = evaluateInventory({
      product,
      quantity: 6,
      now,
      inventory: [
        inventory({ locationCode: "DEN-01", quantityOnHand: 3, quantityReserved: 1 }),
        inventory({ locationCode: "SEA-01", quantityOnHand: 4, quantityReserved: 0 }),
      ],
    });

    expect(result.status).toBe("split_fulfillment");
    expect(result.blocked).toBe(false);
    expect(result.availableQuantity).toBe(6);
    expect(result.fulfillment).toEqual([
      { productId: product.id, locationCode: "SEA-01", quantity: 4, availableQuantity: 4 },
      { productId: product.id, locationCode: "DEN-01", quantity: 2, availableQuantity: 2 },
    ]);
  });

  it("blocks when inventory is sufficient only as a split but single-warehouse fulfillment is required", () => {
    const result = evaluateInventory({
      product,
      quantity: 6,
      now,
      allowSplitFulfillment: false,
      inventory: [
        inventory({ locationCode: "DEN-01", quantityOnHand: 3, quantityReserved: 1 }),
        inventory({ locationCode: "SEA-01", quantityOnHand: 4, quantityReserved: 0 }),
      ],
    });

    expect(result.status).toBe("insufficient_single_warehouse");
    expect(result.blocked).toBe(true);
    expect(result.fulfillment).toEqual([]);
    expect(result.laterDeliveryOptions).toEqual([
      {
        productId: product.id,
        earliestShipDate: "2026-07-25",
        quantity: 6,
        reason: "Offer a later ship date after warehouse replenishment or transfer.",
      },
    ]);
  });

  it("blocks insufficient inventory when no warehouse, split, or replacement option can satisfy the request", () => {
    const result = evaluateInventory({
      product,
      quantity: 9,
      now,
      inventory: [
        inventory({ locationCode: "DEN-01", quantityOnHand: 3, quantityReserved: 1 }),
        inventory({ locationCode: "SEA-01", quantityOnHand: 2, quantityReserved: 0 }),
      ],
      replacementProducts: [replacement],
      replacementInventory: [inventory({ productId: replacement.id, locationCode: "DEN-01", quantityOnHand: 3, quantityReserved: 0 })],
    });

    expect(result.status).toBe("backordered");
    expect(result.blocked).toBe(true);
    expect(result.availableQuantity).toBe(4);
    expect(result.fulfillment).toEqual([]);
    expect(result.reason).toBe("Insufficient warehouse inventory for the requested quantity.");
  });

  it("proposes a seeded replacement product when requested inventory is insufficient", async () => {
    const service = createInventoryService({
      async getInventory() {
        return {
          inventory: [inventory({ locationCode: "DEN-01", quantityOnHand: 1, quantityReserved: 0 })],
          replacementInventory: [
            inventory({ productId: replacement.id, locationCode: "DEN-01", quantityOnHand: 6, quantityReserved: 1 }),
            inventory({ productId: replacement.id, locationCode: "SEA-01", quantityOnHand: 5, quantityReserved: 0 }),
          ],
        };
      },
      async getReplacementProducts() {
        return [replacement];
      },
    });

    await expect(service.evaluateAvailability({ product, quantity: 7, now })).resolves.toMatchObject({
      status: "replacement_proposed",
      blocked: false,
      replacementProposal: {
        productId: replacement.id,
        sku: "HX-500R",
        fulfillment: [
          { productId: replacement.id, locationCode: "DEN-01", quantity: 5, availableQuantity: 5 },
          { productId: replacement.id, locationCode: "SEA-01", quantity: 2, availableQuantity: 5 },
        ],
      },
    });
  });

  it("blocks stale inventory before promising warehouse availability", () => {
    const result = evaluateInventory({
      product,
      quantity: 2,
      now,
      staleAfterHours: 24,
      inventory: [inventory({ quantityOnHand: 10, updatedAt: "2026-07-16T11:59:59.000Z" })],
    });

    expect(result.status).toBe("stale_inventory");
    expect(result.blocked).toBe(true);
    expect(result.fulfillment).toEqual([]);
    expect(result.staleRecords).toHaveLength(1);
  });
});
