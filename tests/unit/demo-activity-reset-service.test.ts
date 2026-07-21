import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createAdminSupabaseClient = vi.fn();
vi.mock("@/lib/db/admin", () => ({ createAdminSupabaseClient }));

type TableName = "quotes" | "quote_items" | "approvals" | "workflow_events" | "customers" | "products" | "prices" | "inventory" | "discount_policies";
type Row = { id: string; quote_id?: string };
type Db = Record<TableName, Row[]>;

class Query {
  private filters: { column: string; values: string[] }[] = [];
  private action: "select" | "delete" | null = null;
  private shouldCount = false;

  constructor(private readonly db: Db, private readonly table: TableName) {}

  select(_columns: string, options?: { count?: "exact"; head?: boolean }) {
    this.action = "select";
    this.shouldCount = options?.count === "exact";
    return this;
  }

  delete(options?: { count?: "exact" }) {
    this.action = "delete";
    this.shouldCount = options?.count === "exact";
    return this;
  }

  in(column: string, values: string[]) {
    this.filters.push({ column, values });
    return this.execute();
  }

  then(resolve: (value: { data: Row[] | null; error: null; count: number | null }) => void) {
    resolve(this.execute());
  }

  private matchingRows() {
    return this.db[this.table].filter((row) => this.filters.every((filter) => filter.values.includes(String(row[filter.column as keyof Row]))));
  }

  private execute() {
    if (this.action === "delete") {
      const matched = this.matchingRows();
      const matchedIds = new Set(matched.map((row) => row.id));
      this.db[this.table] = this.db[this.table].filter((row) => !matchedIds.has(row.id));

      if (this.table === "quotes") {
        const quoteIds = new Set(matched.map((row) => row.id));
        this.db.quote_items = this.db.quote_items.filter((row) => !quoteIds.has(row.quote_id ?? ""));
        this.db.approvals = this.db.approvals.filter((row) => !quoteIds.has(row.quote_id ?? ""));
        this.db.workflow_events = this.db.workflow_events.filter((row) => !quoteIds.has(row.quote_id ?? ""));
      }

      return { data: null, error: null, count: this.shouldCount ? matched.length : null };
    }

    const rows = this.filters.length > 0 ? this.matchingRows() : this.db[this.table];
    return { data: this.shouldCount ? null : rows.map((row) => ({ id: row.id })), error: null, count: this.shouldCount ? rows.length : null };
  }
}

const createDb = (withActivity: boolean): Db => ({
  quotes: withActivity ? [{ id: "quote-1" }, { id: "quote-2" }] : [],
  quote_items: withActivity ? [{ id: "item-1", quote_id: "quote-1" }, { id: "item-2", quote_id: "quote-2" }] : [],
  approvals: withActivity ? [{ id: "approval-1", quote_id: "quote-1" }] : [],
  workflow_events: withActivity ? [{ id: "event-1", quote_id: "quote-1" }, { id: "event-2", quote_id: "quote-1" }, { id: "event-3", quote_id: "quote-2" }] : [],
  customers: [{ id: "customer-1" }],
  products: [{ id: "product-1" }],
  prices: [{ id: "price-1" }],
  inventory: [{ id: "inventory-1" }],
  discount_policies: [{ id: "policy-1" }],
});

const mockClient = (db: Db) => ({ from: (table: TableName) => new Query(db, table) });

describe("clearDemoQuoteActivity", () => {
  it("deletes quotes and cascaded quote activity while preserving reference data", async () => {
    const db = createDb(true);
    createAdminSupabaseClient.mockReturnValue(mockClient(db));
    const { clearDemoQuoteActivity } = await import("@/lib/services/demo-reset-service");

    await expect(clearDemoQuoteActivity()).resolves.toEqual({
      quotesDeleted: 2,
      quoteItemsDeleted: 2,
      approvalsDeleted: 1,
      workflowEventsDeleted: 3,
    });

    expect(db.quotes).toHaveLength(0);
    expect(db.quote_items).toHaveLength(0);
    expect(db.approvals).toHaveLength(0);
    expect(db.workflow_events).toHaveLength(0);
    expect(db.customers).toHaveLength(1);
    expect(db.products).toHaveLength(1);
    expect(db.prices).toHaveLength(1);
    expect(db.inventory).toHaveLength(1);
    expect(db.discount_policies).toHaveLength(1);
  });

  it("succeeds with zero counts when activity is already empty", async () => {
    const db = createDb(false);
    createAdminSupabaseClient.mockReturnValue(mockClient(db));
    const { clearDemoQuoteActivity } = await import("@/lib/services/demo-reset-service");

    await expect(clearDemoQuoteActivity()).resolves.toEqual({
      quotesDeleted: 0,
      quoteItemsDeleted: 0,
      approvalsDeleted: 0,
      workflowEventsDeleted: 0,
    });
  });
});
