import { describe, expect, it, vi } from "vitest";

import { createQuoteExtractionAdapter } from "@/lib/adapters/ai/quote-extraction-adapter";
import type { OpenAIResponsesClient } from "@/lib/adapters/ai/openai-client";

const mockClient = (output: unknown): OpenAIResponsesClient =>
  ({
    responses: {
      create: vi.fn().mockResolvedValue(output),
    },
  }) as unknown as OpenAIResponsesClient;

describe("createQuoteExtractionAdapter", () => {
  it("extracts and validates structured quote facts from OpenAI Responses output", async () => {
    const sourceText = "Atlas needs 4 HX-500 units by 2026-08-01. Contact buyer@atlas.example.";
    const client = mockClient({
      output_text: JSON.stringify({
        source_text: sourceText,
        customer_name: { value: "Atlas", missing: false, confidence: 0.9, source_span: null },
        opportunity_name: { value: null, missing: true, confidence: 0, source_span: null },
        requested_items: [
          {
            line_number: 1,
            raw_item_description: { value: "4 HX-500 units", missing: false, confidence: 0.8, source_span: null },
            requested_sku: { value: "HX-500", missing: false, confidence: 0.95, source_span: null },
            quantity: { value: 4, missing: false, confidence: 0.95, source_span: null },
            specifications: { value: null, missing: true, confidence: 0, source_span: null },
          },
        ],
        delivery_location: { value: null, missing: true, confidence: 0, source_span: null },
        delivery_date: { value: "2026-08-01", missing: false, confidence: 0.95, source_span: null },
        requested_discount: { value: null, missing: true, confidence: 0, source_span: null },
        installation_requirement: { value: null, missing: true, confidence: 0, source_span: null },
        special_requirements: { value: null, missing: true, confidence: 0, source_span: null },
        missing_fields: ["opportunity_name", "requested_items[0].specifications", "delivery_location", "requested_discount", "installation_requirement", "special_requirements"],
        ambiguities: [],
        clarification_questions: [],
        field_confidence: { customer_name: 0.9 },
        overall_confidence: 0.85,
      }),
    });

    const adapter = createQuoteExtractionAdapter({ client, model: "gpt-test" });

    await expect(adapter.extractQuoteRequest(sourceText)).resolves.toMatchObject({
      customer_name: { value: "Atlas", missing: false },
      requested_items: [{ requested_sku: { value: "HX-500", missing: false }, specifications: { value: null, missing: true } }],
    });
    expect(client.responses.create).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-test" }));
  });

  it("rejects invalid model output instead of accepting invented unsupported claims", async () => {
    const client = mockClient({
      output_text: JSON.stringify({
        source_text: "Need a quote.",
        customer_name: { value: null, missing: true, confidence: 0, source_span: null },
        opportunity_name: { value: null, missing: true, confidence: 0, source_span: null },
        requested_items: [
          {
            line_number: 1,
            raw_item_description: { value: "Need a quote.", missing: false, confidence: 0.8, source_span: null },
            requested_sku: { value: "INVENTED-SKU", missing: false, confidence: 0.9, source_span: null },
            quantity: { value: null, missing: true, confidence: 0, source_span: null },
            specifications: { value: null, missing: true, confidence: 0, source_span: null },
            inventory: { value: "available", missing: false },
          },
        ],
        delivery_location: { value: null, missing: true, confidence: 0, source_span: null },
        delivery_date: { value: null, missing: true, confidence: 0, source_span: null },
        requested_discount: { value: null, missing: true, confidence: 0, source_span: null },
        installation_requirement: { value: null, missing: true, confidence: 0, source_span: null },
        special_requirements: { value: null, missing: true, confidence: 0, source_span: null },
        approval_status: "approved",
        missing_fields: [],
        ambiguities: [],
        clarification_questions: [],
        field_confidence: {},
        overall_confidence: 0.5,
      }),
    });

    const adapter = createQuoteExtractionAdapter({ client, model: "gpt-test" });

    await expect(adapter.extractQuoteRequest("Need a quote.")).rejects.toThrow();
  });

  it("falls back to a conservative null-filled extraction when configured", async () => {
    const client =
      ({
        responses: {
          create: vi.fn().mockRejectedValue(new Error("network unavailable")),
        },
      } as unknown as OpenAIResponsesClient);
    const adapter = createQuoteExtractionAdapter({ client, model: "gpt-test", useFallbackOnError: true });

    await expect(adapter.extractQuoteRequest("Please quote rugged scanners.")).resolves.toMatchObject({
      customer_name: { value: null, missing: true },
      requested_items: [
        {
          requested_sku: { value: null, missing: true },
          raw_item_description: { value: "Please quote rugged scanners.", missing: false },
          quantity: { value: null, missing: true },
        },
      ],
    });
  });
});
