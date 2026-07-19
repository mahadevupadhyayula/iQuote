import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createApprovalsRepository } from "@/lib/repositories/approvals";
import { createCustomersRepository } from "@/lib/repositories/customers";
import { createInventoryRepository } from "@/lib/repositories/inventory";
import { createPricesRepository } from "@/lib/repositories/prices";
import { createProductsRepository } from "@/lib/repositories/products";
import { createQuotesRepository } from "@/lib/repositories/quotes";
import { createWorkflowEventsRepository, WorkflowEventIdempotencyConflictError } from "@/lib/repositories/workflow-events";

const now = "2026-07-18T12:00:00.000Z";
const uuid = (suffix: string) => `90000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;

class Query {
  private rows: Row[];
  private selected = false;
  private orderBy: { key: string; ascending: boolean } | null = null;
  private max: number | null = null;
  constructor(private db: Db, private table: string, private op: "select" | "insert" | "update" | "delete" | "upsert", private payload?: Row | Row[]) {
    this.rows = [...(db[table] ?? [])];
  }
  select() { this.selected = true; return this; }
  eq(key: string, value: unknown) { this.rows = this.rows.filter((r) => r[key] === value); return this; }
  in(key: string, values: unknown[]) { this.rows = this.rows.filter((r) => values.includes(r[key])); return this; }
  lte(key: string, value: unknown) { this.rows = this.rows.filter((r) => String(r[key]) <= String(value)); return this; }
  ilike(key: string, pattern: string) { const needle = pattern.replaceAll("%", "").toLowerCase(); this.rows = this.rows.filter((r) => String(r[key]).toLowerCase().includes(needle)); return this; }
  or(expr: string) {
    if (expr.includes("effective_to.is.null")) {
      const date = expr.split("effective_to.gte.")[1];
      this.rows = this.rows.filter((r) => r.effective_to == null || String(r.effective_to) >= date);
      return this;
    }
    const terms = expr.split(",");
    this.rows = this.rows.filter((r) => terms.some((term) => {
      const [key, operator, raw] = term.split(".");
      if (operator !== "ilike") return false;
      return String(r[key]).toLowerCase().includes(raw.replaceAll("%", "").toLowerCase());
    }));
    return this;
  }
  order(key: string, options?: { ascending?: boolean }) { this.orderBy = { key, ascending: options?.ascending ?? true }; return this; }
  limit(max: number) { this.max = max; return this; }
  async maybeSingle() { const data = this.materialize()[0] ?? null; return { data, error: null }; }
  async single() { const data = this.materialize()[0] ?? null; return { data, error: data ? null : { message: "No rows" } }; }
  then(resolve: (value: { data: Row[] | null; error: null }) => unknown) { return Promise.resolve({ data: this.materialize(), error: null }).then(resolve); }
  private materialize() {
    if (this.op === "insert" || this.op === "upsert") this.applyInsert();
    if (this.op === "update") this.applyUpdate();
    if (this.op === "delete") this.applyDelete();
    let output = this.rows;
    if (this.table === "quotes" && this.selected) output = output.map((q) => ({ ...q, quote_items: this.db.quote_items.filter((i) => i.quote_id === q.id) }));
    if (this.table === "product_aliases" && this.selected) output = output.map((a) => ({ ...a, product: this.db.products.find((p) => p.id === a.product_id) }));
    if (this.orderBy) output = [...output].sort((a, b) => String(a[this.orderBy!.key]).localeCompare(String(b[this.orderBy!.key])) * (this.orderBy!.ascending ? 1 : -1));
    if (this.max != null) output = output.slice(0, this.max);
    return output;
  }
  private applyInsert() {
    const inputs = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
    this.rows = inputs.map((input, index) => {
      const defaults =
        this.table === "approvals"
          ? { status: "pending", requested_at: now, decided_at: null, approver_id: null, comments: null }
          : this.table === "workflow_events"
            ? { created_at: now, idempotency_key: null }
            : { created_at: now, updated_at: now };
      return { id: input.id ?? uuid(`${Date.now()}${index}`), ...defaults, ...input };
    });
    this.db[this.table].push(...this.rows);
    this.op = "select";
  }
  private applyUpdate() {
    const set = this.payload as Row;
    this.db[this.table] = this.db[this.table].map((row) => this.rows.includes(row) ? { ...row, ...set, updated_at: now } : row);
    this.rows = this.db[this.table].filter((row) => Object.entries(set).every(([k, v]) => row[k] === v) || this.rows.some((old) => old.id === row.id));
    this.op = "select";
  }
  private applyDelete() { this.db[this.table] = this.db[this.table].filter((row) => !this.rows.includes(row)); this.rows = []; this.op = "select"; }
}

const createClient = (db: Db) => ({
  from: (table: string) => ({
    select: () => new Query(db, table, "select").select(),
    insert: (payload: Row | Row[]) => new Query(db, table, "insert", payload),
    update: (payload: Row) => new Query(db, table, "update", payload),
    delete: () => new Query(db, table, "delete"),
    upsert: (payload: Row) => new Query(db, table, "upsert", payload),
  }),
});

const baseDb = (): Db => ({
  customers: [{ id: uuid("1"), external_id: "DEMO-CUST-ATLAS", name: "Atlas Manufacturing", legal_name: null, domain: null, billing_email: "ap@atlas.example", phone: null, billing_address: {}, shipping_address: {}, metadata: { customer_tier: "gold" }, created_at: now, updated_at: now }],
  products: [{ id: uuid("200"), sku: "AX-200", name: "AX-200 Industrial Compressor", description: null, status: "active", unit_of_measure: "each", metadata: {}, created_at: now, updated_at: now }],
  product_aliases: [{ id: uuid("201"), product_id: uuid("200"), alias: "AX200", source: "customer_csv", created_at: now }],
  prices: [
    { id: uuid("301"), product_id: uuid("200"), currency_code: "USD", unit_price: 1200, effective_from: "2026-01-01", effective_to: "2026-06-30", price_type: "list", customer_tier: null, customer_id: null, unit_cost: 800, source_name: "old", source_version: "1", created_at: now },
    { id: uuid("302"), product_id: uuid("200"), currency_code: "USD", unit_price: 1280, effective_from: "2026-07-01", effective_to: null, price_type: "list", customer_tier: null, customer_id: null, unit_cost: 820, source_name: "demo", source_version: "2", created_at: now },
  ],
  inventory: [{ id: uuid("401"), product_id: uuid("200"), warehouse_code: "CHI-01", quantity_on_hand: 18, quantity_reserved: 2, reorder_point: 4, source_name: "wms", source_version: "1", refreshed_at: now, updated_at: now }],
  quotes: [], quote_items: [], approvals: [], workflow_events: [],
});

describe("repository integration contracts", () => {
  let db: Db;
  beforeEach(() => { db = baseDb(); });

  it("supports customer, product SKU and product alias lookups", async () => {
    const client = createClient(db) as never;
    await expect(createCustomersRepository(client).findByExternalId("DEMO-CUST-ATLAS")).resolves.toMatchObject({ name: "Atlas Manufacturing" });
    await expect(createProductsRepository(client).findBySku("AX-200")).resolves.toMatchObject({ id: uuid("200") });
    await expect(createProductsRepository(client).findByAlias("AX200")).resolves.toMatchObject({ sku: "AX-200" });
  });

  it("selects active prices and warehouse inventory", async () => {
    const client = createClient(db) as never;
    await expect(createPricesRepository(client).findListPrice({ productId: uuid("200"), onDate: "2026-07-18" })).resolves.toMatchObject({ unit_price: 1280, source_version: "2" });
    await expect(createInventoryRepository(client).findAtLocation(uuid("200"), "CHI-01")).resolves.toMatchObject({ quantity_on_hand: 18, quantity_reserved: 2, location_code: "CHI-01" });
  });

  it("persists quotes with quote items", async () => {
    const quote = await createQuotesRepository(createClient(db) as never).create({ id: uuid("501"), customer_id: uuid("1"), opportunity_id: null, quote_number: "Q-INT-1", status: "draft", currency_code: "USD", subtotal_amount: 5120, discount_amount: 0, tax_amount: 0, total_amount: 5120, valid_until: null, submitted_at: null, approved_at: null, sent_at: null, accepted_at: null, sla_due_at: null, metadata: {} }, [{ id: uuid("502"), quote_id: uuid("501"), product_id: uuid("200"), line_number: 1, sku: "AX-200", description: "AX-200", quantity: 4, unit_price: 1280, discount_bps: 0, discount_amount: 0, line_total_amount: 5120, metadata: {} }]);
    expect(quote.items).toHaveLength(1);
    expect(quote.items[0]).toMatchObject({ quote_id: uuid("501"), sku: "AX-200" });
  });

  it("persists approvals and workflow events idempotently", async () => {
    const client = createClient(db) as never;
    const approvals = createApprovalsRepository(client);
    const events = createWorkflowEventsRepository(client);
    const input = { id: uuid("601"), quote_id: uuid("501"), required_role: "product_manager", requested_by: null, metadata: {} };
    const approval = await approvals.createPendingApproval(input);
    expect(await approvals.createPendingApproval(input)).toEqual(approval);
    const eventInput = { id: uuid("701"), quote_id: uuid("501"), event_type: "updated" as const, actor_id: null, from_status: "draft" as const, to_status: "draft" as const, payload: { action: "save" }, idempotency_key: "save-1" };
    const event = await events.record(eventInput);
    expect(await events.record(eventInput)).toEqual(event);
    await expect(events.record({ ...eventInput, payload: { action: "changed" } })).rejects.toBeInstanceOf(WorkflowEventIdempotencyConflictError);
  });
});
