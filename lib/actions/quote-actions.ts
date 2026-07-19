"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createQuoteExtractionAdapter } from "@/lib/adapters/ai/quote-extraction-adapter";
import { createMockNotificationsAdapter } from "@/lib/adapters/mocks";
import { createServerSupabaseClient } from "@/lib/db/server";
import { evaluateMarginFloor } from "@/lib/rules/margin-rules";
import { evaluateQuoteReadiness } from "@/lib/rules/readiness-rules";
import { createRepositories } from "@/lib/repositories";
import type { QuoteItemCreateInput } from "@/lib/repositories/quotes";
import { calculateQuote } from "@/lib/services/quote-calculation-service";
import { createInventoryService } from "@/lib/services/inventory-service";
import { createExtractionService } from "@/lib/services/extraction-service";
import { createProductMatchingService } from "@/lib/services/product-matching-service";
import { createWorkflowService } from "@/lib/services/workflow-service";
import { createQuoteCommercialConfigurationService } from "@/lib/services/quote-commercial-configuration-service";
import { allInventoryConfirmed, quoteConfigurationCompletion } from "@/lib/rules/quote-configuration-completion";
import { createQuotePricingResolutionService } from "@/lib/services/quote-pricing-resolution-service";
import {
  applyRepCorrectionsActionSchema,
  continueQuoteConfigurationActionSchema,
  reviseRejectedQuoteActionSchema,
  createQuoteDraftActionSchema,
  extractAndBuildQuoteActionSchema,
  generateQuoteActionSchema,
  saveQuoteDraftActionSchema,
  selectFulfillmentActionSchema,
  sendQuoteActionSchema,
  submitQuoteForApprovalActionSchema,
  type ApplyRepCorrectionsActionInput,
  type ContinueQuoteConfigurationActionInput,
  type ReviseRejectedQuoteActionInput,
  type CreateQuoteDraftActionInput,
  type ExtractAndBuildQuoteActionInput,
  type GenerateQuoteActionInput,
  type SaveQuoteDraftActionInput,
  type SelectFulfillmentActionInput,
  type SendQuoteActionInput,
  type SubmitQuoteForApprovalActionInput,
} from "@/lib/schemas/quote-action-schemas";
import type { QuoteItemRecord, QuoteRecord } from "@/lib/schemas/shared-records";

const quotePath = (quoteId: string) => `/quotes/${quoteId}`;
const money = (amount: number) => Math.round(amount * 100) / 100;
const quoteNumber = () => `Q-${Date.now()}`;

const getContext = () => {
  const repositories = createRepositories(createServerSupabaseClient());
  return {
    repositories,
    workflowService: createWorkflowService({ quotesRepository: repositories.quotes, workflowEventsRepository: repositories.workflowEvents }),
  };
};

const recordUpdate = async (quote: QuoteRecord, actorId: string | null | undefined, action: string, payload: Record<string, unknown>) => {
  const { repositories } = getContext();
  await repositories.workflowEvents.record({
    quote_id: quote.id,
    event_type: "updated",
    actor_id: actorId ?? null,
    from_status: quote.status,
    to_status: quote.status,
    payload: { action, ...payload },
  });
};


const asObject = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {});

const mergeQuoteMetadata = (current: Record<string, unknown>, updates: { metadata?: Record<string, unknown>; requirements?: Record<string, unknown>; clarification_answers?: Record<string, unknown>; product_candidates?: Record<string, unknown>; rep_confirmation?: Record<string, unknown>; original_request_text?: string }) => ({
  ...current,
  ...updates.metadata,
  extraction: {
    ...asObject(current.extraction),
    ...(updates.original_request_text && !("original_request_text" in asObject(current.extraction)) ? { original_request_text: updates.original_request_text } : {}),
  },
  requirements: {
    ...asObject(current.requirements),
    ...updates.requirements,
    ...(updates.clarification_answers ? { clarification_answers: updates.clarification_answers } : {}),
  },
  review: {
    ...asObject(current.review),
    ...(updates.product_candidates ? { product_candidates: updates.product_candidates } : {}),
    ...(updates.rep_confirmation ? { rep_confirmation: updates.rep_confirmation } : {}),
  },
});

const quoteSummary = (quote: QuoteRecord & { items?: QuoteItemRecord[] }) => ({
  customer_id: quote.customer_id,
  opportunity_id: quote.opportunity_id,
  currency_code: quote.currency_code,
  valid_until: quote.valid_until,
  subtotal_amount: quote.subtotal_amount,
  discount_amount: quote.discount_amount,
  total_amount: quote.total_amount,
  line_count: quote.items?.length ?? null,
  metadata: {
    extraction: asObject(quote.metadata.extraction),
    requirements: asObject(quote.metadata.requirements),
    review: asObject(quote.metadata.review),
  },
});

const lineTotals = (lines: Pick<QuoteItemCreateInput, "quantity" | "unit_price" | "discount_bps">[]) => {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
  const discount = lines.reduce((sum, line) => sum + (line.quantity * line.unit_price * (line.discount_bps ?? 0)) / 10_000, 0);
  return { subtotal: money(subtotal), discount: money(discount), total: money(subtotal - discount) };
};

const toQuoteItems = (lines: NonNullable<ApplyRepCorrectionsActionInput["lines"]> = []): Omit<QuoteItemCreateInput, "quote_id">[] =>
  lines.map((line, index) => {
    const subtotal = line.quantity * (line.unit_price ?? 0);
    const discountBps = line.discount_bps ?? 0;
    const discount = (subtotal * discountBps) / 10_000;
    return {
      product_id: line.product_id ?? null,
      line_number: index + 1,
      sku: line.sku,
      description: line.description,
      quantity: line.quantity,
      unit_price: money(line.unit_price ?? 0),
      discount_bps: discountBps,
      discount_amount: money(discount),
      line_total_amount: money(subtotal - discount),
      metadata: line.metadata ?? {},
    };
  });

const refreshQuoteAmounts = async (quoteId: string, items: QuoteItemRecord[]) => {
  const { repositories } = getContext();
  const totals = lineTotals(items);
  return repositories.quotes.update(quoteId, {
    subtotal_amount: totals.subtotal,
    discount_amount: totals.discount,
    total_amount: totals.total,
  });
};

export async function createQuoteDraft(input: CreateQuoteDraftActionInput) {
  const data = createQuoteDraftActionSchema.parse(input);
  const { repositories } = getContext();
  const quote = await repositories.quotes.create({
    customer_id: data.customer_id,
    opportunity_id: data.opportunity_id ?? null,
    quote_number: quoteNumber(),
    status: "draft",
    currency_code: data.currency_code,
    subtotal_amount: 0,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 0,
    valid_until: data.valid_until ?? null,
    submitted_at: null,
    approved_at: null,
    sent_at: null,
    accepted_at: null,
    sla_due_at: null,
    metadata: data.metadata,
  });
  await repositories.workflowEvents.record({ quote_id: quote.id, event_type: "created", actor_id: data.actor_id ?? null, from_status: null, to_status: "draft", payload: { action: "create_quote_draft" } });
  revalidatePath(quotePath(quote.id));
  return quote;
}

export async function extractAndBuildQuote(input: ExtractAndBuildQuoteActionInput) {
  const data = extractAndBuildQuoteActionSchema.parse(input);
  const { repositories } = getContext();
  const extractionService = createExtractionService({ quotesRepository: repositories.quotes, workflowEventsRepository: repositories.workflowEvents, extractionAdapter: createQuoteExtractionAdapter() });
  const result = await extractionService.extractAndPersist({ quoteId: data.quote_id, sourceText: data.source_text, actorId: data.actor_id ?? null });
  const extractedLines = result.extraction?.requested_items.map((line) => ({ lineNumber: line.line_number, sku: line.requested_sku.value, description: line.raw_item_description.value })).filter((line) => line.sku || line.description) ?? [];
  const matches = await createProductMatchingService({ productsRepository: repositories.products }).matchLines(extractedLines);
  const items = await Promise.all(matches.map(async (match) => {
    const extracted = result.extraction?.requested_items.find((line) => line.line_number === match.lineNumber);
    const price = match.product ? await repositories.prices.findCurrentPrice(match.product.id, result.quote.currency_code) : null;
    return toQuoteItems([{ product_id: match.product?.id ?? null, sku: match.product?.sku ?? extracted?.requested_sku.value ?? "UNMATCHED", description: match.product?.name ?? extracted?.raw_item_description.value ?? "Unmatched item", quantity: extracted?.quantity.value ?? 1, unit_price: price?.unit_price ?? 0, discount_bps: 0, metadata: { product_match: match } }])[0];
  }));
  const replaced = await repositories.quotes.replaceItems(data.quote_id, items);
  const refreshed = await refreshQuoteAmounts(data.quote_id, replaced);
  const quote = await repositories.quotes.update(data.quote_id, { metadata: mergeQuoteMetadata(refreshed.metadata, { original_request_text: data.source_text }) });
  await recordUpdate(quote, data.actor_id, "extract_and_build_quote", { idempotency_key: data.idempotency_key, matched_lines: matches.length });
  revalidatePath(quotePath(data.quote_id));
  return { quote, extraction: result.extraction, matches, items: replaced };
}

const persistRepCorrections = async (data: ApplyRepCorrectionsActionInput | SaveQuoteDraftActionInput, action: "apply_rep_corrections" | "save_quote_draft") => {
  const { repositories } = getContext();
  const before = await repositories.quotes.findById(data.quote_id);
  if (!before) throw new Error(`Quote ${data.quote_id} was not found.`);
  if (data.lines) await repositories.quotes.replaceItems(data.quote_id, toQuoteItems(data.lines));
  const latest = await repositories.quotes.findById(data.quote_id);
  if (!latest) throw new Error(`Quote ${data.quote_id} was not found after corrections.`);
  const totals = lineTotals(latest.items);
  const updated = await repositories.quotes.update(data.quote_id, {
    customer_id: "customer_id" in data && data.customer_id ? data.customer_id : before.customer_id,
    opportunity_id: "opportunity_id" in data && data.opportunity_id !== undefined ? data.opportunity_id : before.opportunity_id,
    currency_code: data.currency_code ?? before.currency_code,
    valid_until: data.valid_until ?? before.valid_until,
    subtotal_amount: totals.subtotal,
    discount_amount: totals.discount,
    total_amount: totals.total,
    metadata: mergeQuoteMetadata(before.metadata, data),
  });
  const after = { ...updated, items: latest.items };
  await recordUpdate(updated, data.actor_id, action, { before: quoteSummary(before), after: quoteSummary(after) });
  revalidatePath(quotePath(data.quote_id));
  return updated;
};

export async function applyRepCorrections(input: ApplyRepCorrectionsActionInput) {
  return persistRepCorrections(applyRepCorrectionsActionSchema.parse(input), "apply_rep_corrections");
}

export async function selectFulfillment(input: SelectFulfillmentActionInput) {
  const data = selectFulfillmentActionSchema.parse(input);
  const { repositories } = getContext();
  const quote = await repositories.quotes.findById(data.quote_id);
  if (!quote) throw new Error(`Quote ${data.quote_id} was not found.`);
  const targetItem = quote.items.find((item) => item.line_number === data.line_number);
  if (!targetItem?.product_id) throw new Error(`Quote line ${data.line_number} does not have a product to fulfill.`);
  const product = await repositories.products.findById(targetItem.product_id);
  if (!product) throw new Error(`Product ${targetItem.product_id} was not found.`);
  const inventoryService = createInventoryService({
    inventoryRepository: repositories.inventory,
    productsRepository: repositories.products,
  });
  const inventoryDecision = await inventoryService.evaluateAvailability({ product, quantity: targetItem.quantity, allowSplitFulfillment: true });
  const fulfillment = data.fulfillment ?? inventoryDecision.fulfillment;
  if (fulfillment.length === 0 || inventoryDecision.blocked) throw new Error(inventoryDecision.reason ?? `Inventory is not fulfillable for quote line ${data.line_number}.`);
  const items = quote.items.map((item) => item.line_number === data.line_number ? { ...item, metadata: { ...item.metadata, inventory_decision: inventoryDecision, selected_inventory_decision: { ...inventoryDecision, fulfillment }, selected_fulfillment: fulfillment, inventory_confirmed_at: new Date().toISOString() } } : item);
  const replacementItems = items.map((item): QuoteItemCreateInput => {
    const { id, created_at, ...replacementItem } = item as QuoteItemRecord;
    void id;
    void created_at;
    return replacementItem;
  });
  await repositories.quotes.replaceItems(data.quote_id, replacementItems);
  let updated = await repositories.quotes.update(data.quote_id, { metadata: { ...quote.metadata, fulfillment_selected_at: new Date().toISOString() } });
  await recordUpdate(updated, data.actor_id, "select_fulfillment", { line_number: data.line_number, fulfillment: data.fulfillment, inventory_decision: inventoryDecision });
  const latest = await repositories.quotes.findById(data.quote_id);
  const completion = latest ? quoteConfigurationCompletion(latest.items) : null;
  let pricingStatus = typeof updated.metadata.pricing_status === "string"
    ? updated.metadata.pricing_status
    : completion?.allInventorySelectionsApplied === false
      ? "pending_inventory"
      : completion?.allProductMatchesConfirmed === false
        ? "pending_product_confirmation"
        : "not_started";
  let pricingBlockers = Array.isArray(updated.metadata.pricing_blockers) ? updated.metadata.pricing_blockers : [];
  if (latest && allInventoryConfirmed(latest.items)) {
    const pricing = await createQuotePricingResolutionService(repositories).resolveQuotePricing({ quoteId: data.quote_id, actorId: data.actor_id ?? null });
    updated = pricing.quote;
    pricingStatus = typeof updated.metadata.pricing_status === "string" ? updated.metadata.pricing_status : pricing.pricingResolved ? "resolved" : "blocked";
    pricingBlockers = pricing.blockers;
  }
  revalidatePath(quotePath(data.quote_id));
  revalidatePath(`${quotePath(data.quote_id)}/configure`);
  return { quote: updated, pricingStatus, pricingBlockers };
}

export async function submitQuoteForApproval(input: SubmitQuoteForApprovalActionInput) {
  const data = submitQuoteForApprovalActionSchema.parse(input);
  const { repositories, workflowService } = getContext();
  const quote = await repositories.quotes.findById(data.quote_id);
  if (!quote) throw new Error(`Quote ${data.quote_id} was not found.`);
  const discountBps = quote.subtotal_amount > 0 ? Math.round((quote.discount_amount / quote.subtotal_amount) * 10_000) : 0;
  const marginBps = calculateQuote(quote.items.map((item) => ({ quantity: item.quantity, unitPriceCents: Math.round(item.unit_price * 100), unitCostCents: Math.round(Number(item.metadata.unit_cost ?? 0) * 100), discountBps: item.discount_bps }))).grossMarginBps;
  const { createApprovalService } = await import("@/lib/services/approval-service");
  const evaluation = await createApprovalService(repositories.prices).evaluatePolicy({ requestedDiscountBps: discountBps, projectedMarginBps: marginBps });
  if (evaluation.requiredRole) {
    const existingApproval = await repositories.approvals.findPendingForRole(data.quote_id, evaluation.requiredRole);
    if (!existingApproval) await repositories.approvals.request({ quote_id: data.quote_id, required_role: evaluation.requiredRole, requested_by: data.actor_id ?? null, metadata: { evaluation } });
  }
  const result = await workflowService.transitionQuote({ quoteId: data.quote_id, toStatus: evaluation.requiredRole ? "pending_approval" : "approved", actorId: data.actor_id ?? null, payload: { action: "submit_quote_for_approval", evaluation }, idempotencyKey: data.idempotency_key });
  revalidatePath(quotePath(data.quote_id));
  return result.quote;
}

export async function generateQuote(input: GenerateQuoteActionInput) {
  const data = generateQuoteActionSchema.parse(input);
  const { repositories, workflowService } = getContext();
  const quote = await repositories.quotes.findById(data.quote_id);
  if (!quote) throw new Error(`Quote ${data.quote_id} was not found.`);
  const productIds = quote.items.map((item) => item.product_id).filter((id): id is string => Boolean(id));
  const [products, prices, approvals] = await Promise.all([Promise.all(productIds.map((id) => repositories.products.findById(id))), repositories.prices.listCurrentPrices(productIds, quote.currency_code), repositories.approvals.listByQuote(data.quote_id)]);
  const readiness = evaluateQuoteReadiness({ customerId: quote.customer_id, currencyCode: quote.currency_code, lines: quote.items.map((item) => ({ productId: item.product_id, sku: item.sku, description: item.description, quantity: item.quantity })), products: products.filter((product): product is NonNullable<typeof product> => Boolean(product)), prices: prices.map((price) => ({ productId: price.product_id, unitPrice: price.unit_price, currencyCode: price.currency_code, effectiveFrom: price.effective_from, effectiveTo: price.effective_to })), inventoryDecisions: quote.items.map((item) => item.metadata.inventory_decision).filter(Boolean) as never, marginPolicy: evaluateMarginFloor({ sellPriceCents: Math.round(quote.total_amount * 100), costCents: 0, floorBps: 0 }), approvals: approvals.map((approval) => ({ requiredRole: approval.required_role, status: approval.status })), paymentTerms: data.payment_terms ?? (quote.metadata.payment_terms as never) });
  const updated = await repositories.quotes.update(data.quote_id, { metadata: { ...quote.metadata, readiness, payment_terms: data.payment_terms ?? quote.metadata.payment_terms, generated_at: readiness.ready ? new Date().toISOString() : null } });
  if (readiness.ready && updated.status === "draft") await workflowService.transitionQuote({ quoteId: data.quote_id, toStatus: "approved", actorId: data.actor_id ?? null, payload: { action: "generate_quote", readiness }, idempotencyKey: data.idempotency_key });
  await recordUpdate(updated, data.actor_id, "generate_quote", { readiness });
  revalidatePath(quotePath(data.quote_id));
  return { quote: await repositories.quotes.findById(data.quote_id), readiness };
}

export async function sendQuote(input: SendQuoteActionInput) {
  const data = sendQuoteActionSchema.parse(input);
  const { repositories, workflowService } = getContext();
  const quote = await repositories.quotes.findById(data.quote_id);
  if (!quote) throw new Error(`Quote ${data.quote_id} was not found.`);
  if (quote.status !== "approved") throw new Error(`Quote ${data.quote_id} is ${quote.status} and cannot be sent.`);
  const pdfUrl = `/api/quotes/${data.quote_id}/pdf`;
  const receipt = await createMockNotificationsAdapter().send({ to: data.recipient_email, subject: `Quote ${quote.quote_number} is ready`, body: `${data.message ?? "Your quote is ready for review."}\n\nPDF: ${pdfUrl}`, channel: "email", metadata: { quote_id: data.quote_id, pdf_url: pdfUrl } });
  await repositories.quotes.update(data.quote_id, { metadata: mergeQuoteMetadata(quote.metadata, { metadata: { mock_delivery_receipt: { ...receipt, recipient_email: data.recipient_email, message: data.message ?? null, pdf_url: pdfUrl } } }) });
  const result = await workflowService.transitionQuote({ quoteId: data.quote_id, toStatus: "sent", actorId: data.actor_id ?? null, payload: { action: "send_quote", receipt, recipient_email: data.recipient_email, pdf_url: pdfUrl }, idempotencyKey: data.idempotency_key });
  revalidatePath(quotePath(data.quote_id));
  return { quote: result.quote, receipt };
}

export async function reviseRejectedQuote(input: ReviseRejectedQuoteActionInput) {
  const data = reviseRejectedQuoteActionSchema.parse(input);
  const { workflowService } = getContext();
  const result = await workflowService.transitionQuote({ quoteId: data.quote_id, toStatus: "draft", actorId: data.actor_id ?? null, payload: { action: "revise_rejected_quote" }, idempotencyKey: data.idempotency_key });
  revalidatePath(quotePath(data.quote_id));
  return result.quote;
}

export async function saveQuoteDraft(input: SaveQuoteDraftActionInput) {
  return persistRepCorrections(saveQuoteDraftActionSchema.parse(input), "save_quote_draft");
}

export async function continueQuoteConfiguration(input: ContinueQuoteConfigurationActionInput) {
  const data = continueQuoteConfigurationActionSchema.parse(input);
  const { repositories, workflowService } = getContext();
  const commercialService = createQuoteCommercialConfigurationService(repositories);
  const result = await commercialService.configureQuoteCommercials({ quoteId: data.quote_id, actorId: data.actor_id ?? null });
  const configurationBlockerCodes = new Set(["missing_required_information", "invalid_product", "missing_price", "missing_price_source", "stale_price", "pricing_exception", "missing_unit_cost", "unresolved_inventory", "stale_inventory", "missing_commercial_calculation", "discount_policy_not_evaluated", "approval_outcome_missing", "margin_policy_failed", "blocking_exception"]);
  const blockers = result.readiness.blockers.filter((blocker) => configurationBlockerCodes.has(blocker.code));
  if (blockers.length > 0) {
    throw new Error(`Configuration has unresolved blockers: ${blockers.map((blocker) => blocker.message).join(" ")}`);
  }
  const requiredRole = result.approvalEvaluation.requiredRole;
  if (requiredRole) {
    await repositories.approvals.request({ quote_id: data.quote_id, required_role: requiredRole, requested_by: data.actor_id ?? null, metadata: { evaluation: result.approvalEvaluation }, idempotency_key: `configuration-${data.quote_id}-${requiredRole}` });
  }
  const latest = await repositories.quotes.findById(data.quote_id);
  if (!latest) throw new Error(`Quote ${data.quote_id} was not found.`);
  if (latest.status !== (requiredRole ? "pending_approval" : "approved")) {
    await workflowService.transitionQuote({ quoteId: data.quote_id, toStatus: requiredRole ? "pending_approval" : "approved", actorId: data.actor_id ?? null, payload: { action: "continue_from_configuration", evaluation: result.approvalEvaluation, effective_discount_bps: result.effectiveDiscountBps, projected_margin_bps: result.calculation.grossMarginBps }, idempotencyKey: data.idempotency_key ?? `continue-configuration-${data.quote_id}` });
  }
  revalidatePath(quotePath(data.quote_id));
  redirect(requiredRole ? `/quotes/${data.quote_id}/approval-pending` : `/quotes/${data.quote_id}/generate`);
}
