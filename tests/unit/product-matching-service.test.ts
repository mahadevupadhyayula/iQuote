import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createProductMatchingService } from "@/lib/services/product-matching-service";
import type { OpenAIResponsesClient } from "@/lib/adapters/ai/openai-client";
import type { ProductRecord } from "@/lib/schemas/shared-records";

const timestamp = "2026-07-18T00:00:00.000Z";
const product = (overrides: Partial<ProductRecord> = {}): ProductRecord => ({
  id: "10000000-0000-4000-8000-000000000001",
  sku: "AX-100",
  name: "AX-100 Pump",
  description: "Pump for controlled quotes",
  status: "active",
  unit_of_measure: "ea",
  metadata: {},
  created_at: timestamp,
  updated_at: timestamp,
  ...overrides,
});

const repository = (overrides: Record<string, unknown> = {}) => ({
  findById: vi.fn(),
  findBySku: vi.fn(async () => null),
  findByName: vi.fn(async () => null),
  findByNormalizedName: vi.fn(async () => null),
  findProductsByAlias: vi.fn(),
  findByAlias: vi.fn(async () => null),
  listSubstitutes: vi.fn(async () => []),
  findReplacement: vi.fn(async () => null),
  search: vi.fn(async () => []),
  addAlias: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  ...overrides,
});

const mockClient = (output: unknown): OpenAIResponsesClient =>
  ({ responses: { create: vi.fn().mockResolvedValue(output) } }) as unknown as OpenAIResponsesClient;

describe("createProductMatchingService", () => {
  it("discovers candidates in exact SKU, product-name, alias, then search order", async () => {
    const byName = product({ id: "10000000-0000-4000-8000-000000000002", sku: "NAME-1" });
    const productsRepository = repository({ findByName: vi.fn(async () => byName) });

    const result = await createProductMatchingService({ productsRepository, client: mockClient({ output_text: "{}" }), model: "gpt-test" }).matchLine({ lineNumber: 1, sku: "UNKNOWN", alias: "alias", description: "AX-100 Pump" });

    expect(result).toMatchObject({ product: byName, method: "product_name", ambiguous: false, requiresRepConfirmation: false });
    expect(productsRepository.findBySku).toHaveBeenCalledWith("UNKNOWN");
    expect(productsRepository.findByName).toHaveBeenCalledWith("AX-100 Pump");
    expect(productsRepository.findByAlias).not.toHaveBeenCalled();
    expect(productsRepository.search).not.toHaveBeenCalled();
  });

  it("sends only extracted line and candidate ids, SKUs, names, and descriptions to AI ranking", async () => {
    const candidate = product({ metadata: { margin: 99 } });
    const client = mockClient({ output_text: JSON.stringify({ product_id: candidate.id, confidence: 0.9, reason: "Best text fit." }) });
    const productsRepository = repository({ search: vi.fn(async () => [candidate, product({ id: "10000000-0000-4000-8000-000000000002", sku: "BX-200" })]) });

    const result = await createProductMatchingService({ productsRepository, client, model: "gpt-test" }).matchLine({ lineNumber: 1, description: "pump" });

    expect(result).toMatchObject({ product: candidate, method: "ai_suggestion", ambiguous: true, requiresRepConfirmation: true });
    const request = vi.mocked(client.responses.create).mock.calls[0][0] as any;
    const payload = JSON.parse(request.input[1].content[0].text as string);
    expect(payload).toEqual({
      extracted_line: { lineNumber: 1, description: "pump" },
      candidates: expect.arrayContaining([expect.objectContaining({ id: candidate.id, sku: candidate.sku, name: candidate.name, description: candidate.description })]),
    });
    expect(JSON.stringify(payload)).not.toContain("metadata");
  });

  it("rejects invalid AI ranking responses and out-of-list product ids as ambiguous", async () => {
    const candidate = product();
    const invalidClient = mockClient({ output_text: JSON.stringify({ product_id: candidate.id, confidence: 2, reason: "invalid" }) });
    const productsRepository = repository({ search: vi.fn(async () => [candidate, product({ id: "10000000-0000-4000-8000-000000000002", sku: "BX-200" })]) });

    await expect(createProductMatchingService({ productsRepository, client: invalidClient, model: "gpt-test" }).matchLine({ lineNumber: 1, description: "pump" })).resolves.toMatchObject({ product: null, ambiguous: true, requiresRepConfirmation: true });

    const outsideClient = mockClient({ output_text: JSON.stringify({ product_id: "10000000-0000-4000-8000-000000000099", confidence: 0.95, reason: "Looks close." }) });
    await expect(createProductMatchingService({ productsRepository, client: outsideClient, model: "gpt-test" }).matchLine({ lineNumber: 1, description: "pump" })).resolves.toMatchObject({ product: null, ambiguous: true, requiresRepConfirmation: true, reason: expect.stringContaining("not in the supplied candidate list") });
  });
});
