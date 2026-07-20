import "server-only";

import { normalizeProductMatchState } from "@/lib/rules/product-match-state";
import { evaluateMarginFloor } from "@/lib/rules/margin-rules";
import type { CustomersRepository } from "@/lib/repositories/customers";
import type { PricesRepository } from "@/lib/repositories/prices";
import type {
  QuotesRepository,
  QuoteItemCreateInput,
} from "@/lib/repositories/quotes";
import type { WorkflowEventsRepository } from "@/lib/repositories/workflow-events";
import type {
  PriceRecord,
  QuoteItemRecord,
} from "@/lib/schemas/shared-records";
import { calculateQuote } from "@/lib/services/quote-calculation-service";
import type { BasisPoints } from "@/lib/utils/money";

export { allInventoryConfirmed } from "@/lib/rules/quote-configuration-completion";

export type PricingBlockerCode =
  | "missing_price"
  | "expired_price"
  | "currency_mismatch"
  | "missing_unit_cost"
  | "unresolved_product_match"
  | "pricing_resolution_failed";
export type PricingBlocker = {
  code: PricingBlockerCode;
  message: string;
  lineNumber?: number;
};
export type QuotePricingResolutionRepositories = {
  customers: Pick<CustomersRepository, "findById">;
  prices: Pick<
    PricesRepository,
    "findCustomerSpecificPrice" | "findCustomerTierPrice" | "findListPrice"
  >;
  quotes: Pick<QuotesRepository, "findById" | "replaceItems" | "update">;
  workflowEvents: Pick<WorkflowEventsRepository, "record">;
};

const cents = (amount: number) => Math.round(amount * 100);
const money = (centsValue: number) => Math.round(centsValue) / 100;
const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const asString = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : null;
const toReplacement = (
  item: QuoteItemRecord,
  metadata: Record<string, unknown>,
  overrides: Partial<Omit<QuoteItemCreateInput, "quote_id">> = {},
): Omit<QuoteItemCreateInput, "quote_id"> => ({
  product_id: item.product_id,
  line_number: item.line_number,
  sku: item.sku,
  description: item.description,
  quantity: item.quantity,
  unit_price: item.unit_price,
  discount_bps: item.discount_bps,
  discount_amount: item.discount_amount,
  line_total_amount: item.line_total_amount,
  metadata,
  ...overrides,
});
const customerTier = (metadata: Record<string, unknown>) =>
  asString(metadata.customer_tier) ??
  asString(asObject(metadata.commercial).customer_tier);

const blocker = (
  code: PricingBlockerCode,
  message: string,
  lineNumber: number,
): PricingBlocker => ({ code, message, lineNumber });

const validatePrice = (
  price: PriceRecord | null,
  productId: string,
  currencyCode: string,
  onDate: string,
  lineNumber: number,
): PricingBlocker | null => {
  if (!price)
    return blocker(
      "missing_price",
      `No active price was found for quote line ${lineNumber}.`,
      lineNumber,
    );
  if (price.product_id !== productId)
    return blocker(
      "pricing_resolution_failed",
      `Resolved price references the wrong product for quote line ${lineNumber}.`,
      lineNumber,
    );
  if (price.currency_code !== currencyCode)
    return blocker(
      "currency_mismatch",
      `Resolved price currency does not match the quote currency for line ${lineNumber}.`,
      lineNumber,
    );
  if (
    price.effective_from > onDate ||
    (price.effective_to != null && price.effective_to < onDate)
  )
    return blocker(
      "expired_price",
      `Resolved price is not active for quote line ${lineNumber}.`,
      lineNumber,
    );
  if (price.unit_price <= 0)
    return blocker(
      "missing_price",
      `Positive unit price is required for quote line ${lineNumber}.`,
      lineNumber,
    );
  if (price.unit_cost == null || price.unit_cost < 0)
    return blocker(
      "missing_unit_cost",
      `Non-negative unit cost is required for quote line ${lineNumber}.`,
      lineNumber,
    );
  if (!price.source_name || !price.source_version)
    return blocker(
      "pricing_resolution_failed",
      `Price source metadata is required for quote line ${lineNumber}.`,
      lineNumber,
    );
  return null;
};

export const createQuotePricingResolutionService = (
  repositories: QuotePricingResolutionRepositories,
) => ({
  async resolveQuotePricing({
    quoteId,
    actorId = null,
    onDate = new Date().toISOString().slice(0, 10),
  }: {
    quoteId: string;
    actorId?: string | null;
    onDate?: string;
  }) {
    const quote = await repositories.quotes.findById(quoteId);
    if (!quote) throw new Error(`Quote ${quoteId} was not found.`);
    const customer = await repositories.customers.findById(quote.customer_id);
    const tier = customer ? customerTier(customer.metadata) : null;
    const blockers: PricingBlocker[] = [];
    const replacements: Omit<QuoteItemCreateInput, "quote_id">[] = [];
    const appliedAt = new Date().toISOString();

    for (const item of quote.items
      .slice()
      .sort((a, b) => a.line_number - b.line_number)) {
      const metadata = { ...item.metadata };
      const state = normalizeProductMatchState(metadata, item.product_id);
      if (!state.productId || !state.confirmed) {
        blockers.push(
          blocker(
            "unresolved_product_match",
            `Quote line ${item.line_number} needs a confirmed product before pricing.`,
            item.line_number,
          ),
        );
        replacements.push(
          toReplacement(item, {
            ...metadata,
            pricing_resolved: false,
            pricing_blocker: blockers.at(-1),
          }),
        );
        continue;
      }
      const price =
        (await repositories.prices.findCustomerSpecificPrice({
          productId: state.productId,
          customerId: quote.customer_id,
          currencyCode: quote.currency_code,
          onDate,
        })) ??
        (tier
          ? await repositories.prices.findCustomerTierPrice({
              productId: state.productId,
              customerTier: tier,
              currencyCode: quote.currency_code,
              onDate,
            })
          : null) ??
        (await repositories.prices.findListPrice({
          productId: state.productId,
          currencyCode: quote.currency_code,
          onDate,
        }));
      const failure = validatePrice(
        price,
        state.productId,
        quote.currency_code,
        onDate,
        item.line_number,
      );
      if (failure || !price) {
        blockers.push(
          failure ??
            blocker(
              "missing_price",
              `No active price was found for quote line ${item.line_number}.`,
              item.line_number,
            ),
        );
        replacements.push(
          toReplacement(
            item,
            {
              ...metadata,
              pricing_resolved: false,
              pricing_blocker: blockers.at(-1),
              price_application: null,
            },
            { unit_price: 0, discount_amount: 0, line_total_amount: 0 },
          ),
        );
        continue;
      }
      const lineCalc = calculateQuote([
        {
          quantity: item.quantity,
          unitPriceCents: cents(price.unit_price),
          unitCostCents: cents(price.unit_cost),
          discountBps: item.discount_bps as BasisPoints,
        },
      ]).lines[0];
      const price_application = {
        price_id: price.id,
        price_type: price.price_type,
        product_id: price.product_id,
        customer_id: quote.customer_id,
        customer_tier: tier,
        currency_code: price.currency_code,
        effective_from: price.effective_from,
        effective_to: price.effective_to,
        source_name: price.source_name,
        source_version: price.source_version,
        applied_at: appliedAt,
      };
      replacements.push({
        product_id: item.product_id,
        line_number: item.line_number,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unit_price: price.unit_price,
        discount_bps: item.discount_bps,
        discount_amount: money(lineCalc.lineDiscountCents),
        line_total_amount: money(lineCalc.lineNetTotalCents),
        metadata: {
          ...metadata,
          unit_cost: price.unit_cost,
          price_application,
          pricing_resolved: true,
          pricing_blocker: null,
        },
      });
    }

    const items = await repositories.quotes.replaceItems(
      quote.id,
      replacements,
    );
    const calculation = calculateQuote(
      items.map((item) => ({
        lineId: item.id,
        quantity: item.quantity,
        unitPriceCents: cents(item.unit_price),
        unitCostCents: cents(Number(item.metadata.unit_cost ?? 0)),
        discountBps: item.discount_bps as BasisPoints,
      })),
    );
    const status = blockers.length > 0 ? "blocked" : "resolved";
    const updated = await repositories.quotes.update(quote.id, {
      subtotal_amount: money(calculation.subtotalCents),
      discount_amount: money(calculation.discountAmountCents),
      total_amount: money(calculation.netTotalCents) + quote.tax_amount,
      metadata: {
        ...quote.metadata,
        pricing_status: status,
        pricing_resolved: blockers.length === 0,
        pricing_blockers: blockers,
        commercial_calculation: {
          gross_amount: money(calculation.subtotalCents),
          discount_amount: money(calculation.discountAmountCents),
          net_amount: money(calculation.netTotalCents),
          tax_amount: quote.tax_amount,
          total_payable: money(calculation.netTotalCents) + quote.tax_amount,
          cost_amount: money(calculation.costCents),
          product_cost: money(calculation.costCents),
          gross_profit_amount: money(calculation.grossProfitCents),
          gross_profit: money(calculation.grossProfitCents),
          gross_margin_bps: calculation.grossMarginBps,
        },
        margin_policy: evaluateMarginFloor({
          sellPriceCents: calculation.sellPriceCents,
          costCents: calculation.costCents,
          floorBps: Number(quote.metadata.margin_floor_bps ?? 0) as BasisPoints,
        }),
      },
    });
    await repositories.workflowEvents.record({
      quote_id: quote.id,
      event_type: "updated",
      actor_id: actorId,
      from_status: quote.status,
      to_status: quote.status,
      payload: {
        action: "pricing_resolution",
        status,
        blocker_count: blockers.length,
      },
    });
    return {
      quote: updated,
      items,
      calculation,
      blockers,
      pricingResolved: blockers.length === 0,
    };
  },
});
