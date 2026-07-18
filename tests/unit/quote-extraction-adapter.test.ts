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
        customer_name: { value: "Atlas", missing: false },
        customer_email: { value: "buyer@atlas.example", missing: false },
        opportunity_name: { value: null, missing: true },
        currency_code: { value: null, missing: true },
        requested_valid_until: { value: null, missing: true },
        lines: [
          {
            line_number: 1,
            sku: { value: "HX-500", missing: false },
            description: { value: null, missing: true },
            quantity: { value: 4, missing: false },
            requested_unit_price: { value: null, missing: true },
            needed_by: { value: "2026-08-01", missing: false },
            notes: { value: null, missing: true },
          },
        ],
        missing_fields: ["opportunity_name", "currency_code", "requested_valid_until", "lines[0].requested_unit_price"],
      }),
    });

    const adapter = createQuoteExtractionAdapter({ client, model: "gpt-test" });

    await expect(adapter.extractQuoteRequest(sourceText)).resolves.toMatchObject({
      customer_name: { value: "Atlas", missing: false },
      lines: [{ sku: { value: "HX-500", missing: false }, requested_unit_price: { value: null, missing: true } }],
    });
    expect(client.responses.create).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-test" }));
  });

  it("rejects invalid model output instead of accepting invented unsupported claims", async () => {
    const client = mockClient({
      output_text: JSON.stringify({
        source_text: "Need a quote.",
        customer_name: { value: null, missing: true },
        customer_email: { value: null, missing: true },
        opportunity_name: { value: null, missing: true },
        currency_code: { value: null, missing: true },
        requested_valid_until: { value: null, missing: true },
        lines: [
          {
            line_number: 1,
            sku: { value: "INVENTED-SKU", missing: false },
            description: { value: "Need a quote.", missing: false },
            quantity: { value: null, missing: true },
            requested_unit_price: { value: null, missing: true },
            needed_by: { value: null, missing: true },
            notes: { value: null, missing: true },
            inventory: { value: "available", missing: false },
          },
        ],
        approval_status: "approved",
        missing_fields: [],
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
      lines: [
        {
          sku: { value: null, missing: true },
          description: { value: "Please quote rugged scanners.", missing: false },
          requested_unit_price: { value: null, missing: true },
        },
      ],
    });
  });
});
