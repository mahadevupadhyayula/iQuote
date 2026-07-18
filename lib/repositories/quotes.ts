import "server-only";

import { quoteItemRecordSchema, quoteRecordSchema, type QuoteItemRecord, type QuoteRecord } from "@/lib/schemas/shared-records";
import type { QuoteStatus } from "@/lib/domain/quote-statuses";
import type { RepositoryClient } from "./types";
import { throwRepositoryError } from "./types";

export type QuoteCreateInput = Omit<QuoteRecord, "id" | "created_at" | "updated_at"> & { id?: string };
export type QuoteUpdateInput = Partial<Omit<QuoteRecord, "id" | "created_at" | "updated_at">>;
export type QuoteItemCreateInput = Omit<QuoteItemRecord, "id" | "created_at"> & { id?: string };
export type QuoteWithItems = QuoteRecord & { items: QuoteItemRecord[] };

const quoteWithItemsSelect = "*, quote_items(*)";

const parseQuoteWithItems = (data: unknown): QuoteWithItems => {
  const row = data as QuoteRecord & { quote_items?: unknown[] };
  return {
    ...quoteRecordSchema.parse(row),
    items: quoteItemRecordSchema.array().parse(row.quote_items ?? []),
  };
};

export const createQuotesRepository = (client: RepositoryClient) => ({
  async findById(id: string) {
    const { data, error } = await client.from("quotes").select(quoteWithItemsSelect).eq("id", id).maybeSingle();
    throwRepositoryError("Find quote by id", error);
    return data ? parseQuoteWithItems(data) : null;
  },

  async findByQuoteNumber(quoteNumber: string) {
    const { data, error } = await client.from("quotes").select(quoteWithItemsSelect).eq("quote_number", quoteNumber).maybeSingle();
    throwRepositoryError("Find quote by number", error);
    return data ? parseQuoteWithItems(data) : null;
  },

  async listRecent(limit = 25) {
    const { data, error } = await client
      .from("quotes")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);
    throwRepositoryError("List recent quotes", error);
    return quoteRecordSchema.array().parse(data ?? []);
  },

  async listByCustomer(customerId: string, limit = 25) {
    const { data, error } = await client
      .from("quotes")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    throwRepositoryError("List quotes by customer", error);
    return quoteRecordSchema.array().parse(data ?? []);
  },

  async createQuote(input: QuoteCreateInput) {
    const { data, error } = await client.from("quotes").insert(input).select("*").single();
    throwRepositoryError("Create quote", error);
    return quoteRecordSchema.parse(data);
  },

  async addItems(quoteId: string, items: Omit<QuoteItemCreateInput, "quote_id">[]) {
    if (items.length === 0) return [];
    const { data, error } = await client.from("quote_items").insert(items.map((item) => ({ ...item, quote_id: quoteId }))).select("*");
    throwRepositoryError("Add quote items", error);
    return quoteItemRecordSchema.array().parse(data ?? []);
  },

  async create(input: QuoteCreateInput, items: QuoteItemCreateInput[] = []) {
    const { data, error } = await client.from("quotes").insert(input).select("*").single();
    throwRepositoryError("Create quote", error);
    const quote = quoteRecordSchema.parse(data);

    if (items.length > 0) {
      const { error: itemsError } = await client.from("quote_items").insert(items.map((item) => ({ ...item, quote_id: quote.id })));
      throwRepositoryError("Create quote items", itemsError);
    }

    const { data: quoteWithItems, error: quoteWithItemsError } = await client.from("quotes").select(quoteWithItemsSelect).eq("id", quote.id).single();
    throwRepositoryError("Find created quote", quoteWithItemsError);
    return parseQuoteWithItems(quoteWithItems);
  },

  async replaceItems(quoteId: string, items: Omit<QuoteItemCreateInput, "quote_id">[]) {
    throwRepositoryError("Delete quote items", (await client.from("quote_items").delete().eq("quote_id", quoteId)).error);
    if (items.length === 0) return [];
    const { data, error } = await client.from("quote_items").insert(items.map((item) => ({ ...item, quote_id: quoteId }))).select("*");
    throwRepositoryError("Replace quote items", error);
    return quoteItemRecordSchema.array().parse(data ?? []);
  },

  async update(id: string, input: QuoteUpdateInput) {
    const { data, error } = await client.from("quotes").update(input).eq("id", id).select("*").single();
    throwRepositoryError("Update quote", error);
    return quoteRecordSchema.parse(data);
  },

  async updateStatus(id: string, status: QuoteStatus, timestamps: Partial<Pick<QuoteRecord, "submitted_at" | "approved_at" | "sent_at" | "accepted_at">> = {}) {
    const { data, error } = await client.from("quotes").update({ status, ...timestamps }).eq("id", id).select("*").single();
    throwRepositoryError("Update quote status", error);
    return quoteRecordSchema.parse(data);
  },

  async markCompleted(id: string, completedAt = new Date().toISOString()) {
    const { data, error } = await client.from("quotes").update({ completed_at: completedAt }).eq("id", id).select("*").single();
    throwRepositoryError("Mark quote completed", error);
    return quoteRecordSchema.parse(data);
  },
});

export type QuotesRepository = ReturnType<typeof createQuotesRepository>;
