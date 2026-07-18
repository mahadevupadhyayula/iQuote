import { evaluateInventory, type EvaluateInventoryInput, type InventoryDecision, type InventoryRuleProduct } from "@/lib/rules/inventory-rules";

export type InventoryRulesProvider = {
  getInventory(input: Pick<EvaluateInventoryInput, "product" | "quantity">): Promise<Pick<EvaluateInventoryInput, "inventory" | "replacementInventory">>;
  getReplacementProducts?(product: InventoryRuleProduct): Promise<InventoryRuleProduct[]>;
};

export type InventoryRequest = Pick<
  EvaluateInventoryInput,
  "product" | "quantity" | "now" | "staleAfterHours" | "allowSplitFulfillment" | "laterDeliveryDays"
>;

export const createInventoryService = (provider: InventoryRulesProvider) => ({
  async evaluateAvailability(request: InventoryRequest): Promise<InventoryDecision> {
    const [inventoryRules, replacementProducts] = await Promise.all([
      provider.getInventory(request),
      provider.getReplacementProducts?.(request.product) ?? Promise.resolve([]),
    ]);

    return evaluateInventory({
      ...request,
      ...inventoryRules,
      replacementProducts,
    });
  },
});

export type InventoryService = ReturnType<typeof createInventoryService>;
