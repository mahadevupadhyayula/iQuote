import { z } from "zod";

export const productMatchingSuggestionSchema = z.object({
  product_id: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  ambiguous: z.boolean().optional(),
});

export type ProductMatchingSuggestion = z.infer<typeof productMatchingSuggestionSchema>;
