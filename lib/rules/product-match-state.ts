export type ProductMatchState = {
  productId: string | null;
  method: string;
  confidence: number;
  confirmed: boolean;
  requiresConfirmation: boolean;
};

const asObject = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asString = (value: unknown) => typeof value === "string" && value.length > 0 ? value : null;
const asNumber = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;

const candidateProductId = (candidate: Record<string, unknown>) => asString(candidate.product_id) ?? asString(candidate.productId) ?? asString(asObject(candidate.product).id);

export const normalizeProductMatchState = (metadata: Record<string, unknown>, lineProductId?: string | null): ProductMatchState => {
  const productMatch = asObject(metadata.product_match);
  const confirmation = asObject(metadata.product_confirmation);
  const deterministicMatch = asObject(metadata.deterministic_match);
  const candidates = Array.isArray(metadata.catalogue_candidates) ? metadata.catalogue_candidates.map(asObject) : [];
  const reviewRequired = metadata.review_required === true || productMatch.review_required === true;

  const productId = lineProductId ?? asString(productMatch.product_id) ?? asString(productMatch.productId) ?? asString(asObject(productMatch.product).id) ?? asString(deterministicMatch.id) ?? candidateProductId(candidates[0] ?? {});
  const method = asString(productMatch.method) ?? asString(deterministicMatch.method) ?? (Object.keys(deterministicMatch).length > 0 ? "deterministic_match" : productId ? "manual" : "unmatched");
  const confidence = asNumber(productMatch.confidence, asNumber(deterministicMatch.confidence, productId ? 1 : 0));
  const explicitlyConfirmed = confirmation.confirmed === true || metadata.product_confirmed === true;
  const deterministicExact = ["exact_sku", "sku_exact", "deterministic_sku", "exact_alias", "alias_exact", "exact_name", "name_exact", "deterministic_match", "manual"].includes(method) && confidence >= 0.95;
  const ambiguous = method === "unmatched" || method === "ai_ranked" || method === "ambiguous" || reviewRequired || candidates.length > 1 || confidence < 0.95;
  const confirmed = Boolean(productId) && (explicitlyConfirmed || (deterministicExact && !ambiguous));

  return { productId, method, confidence, confirmed, requiresConfirmation: !productId || (!confirmed && ambiguous) };
};
