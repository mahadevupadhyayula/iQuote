import "server-only";

import { createAdminSupabaseClient } from "@/lib/db/admin";

const demoSeed = "atlas-northstar";

const demoCustomers = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    external_id: "DEMO-CUST-ATLAS",
    name: "Atlas Manufacturing",
    legal_name: "Atlas Manufacturing, Inc.",
    domain: "atlas.example",
    billing_email: "ap@atlas.example",
    phone: "+1-312-555-0142",
    billing_address: {
      line1: "2300 Foundry Way",
      city: "Chicago",
      region: "IL",
      postalCode: "60601",
      country: "US",
    },
    shipping_address: {
      line1: "4100 Assembly Park",
      city: "Cicero",
      region: "IL",
      postalCode: "60804",
      country: "US",
    },
    metadata: { demo_seed: demoSeed, segment: "manufacturing" },
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    external_id: "DEMO-CUST-NORTHSTAR",
    name: "Northstar Mining",
    legal_name: "Northstar Mining Ltd.",
    domain: "northstar.example",
    billing_email: "procurement@northstar.example",
    phone: "+1-406-555-0198",
    billing_address: {
      line1: "88 Ore Ridge Road",
      city: "Billings",
      region: "MT",
      postalCode: "59101",
      country: "US",
    },
    shipping_address: {
      line1: "12 Pit Access Road",
      city: "Butte",
      region: "MT",
      postalCode: "59701",
      country: "US",
    },
    metadata: { demo_seed: demoSeed, segment: "mining" },
  },
];

const demoProducts = [
  {
    id: "20000000-0000-4000-8000-000000000200",
    sku: "AX-200",
    name: "AX-200 Industrial Actuator",
    description: "Heavy-duty linear actuator for automated production cells.",
    status: "active",
    unit_of_measure: "each",
    metadata: { demo_seed: demoSeed, family: "actuators" },
  },
  {
    id: "20000000-0000-4000-8000-000000000210",
    sku: "AX-200-FKIT",
    name: "AX-200 Compatible Filter Kit",
    description: "Matched spare filter kit for AX-200 compressor equipment.",
    status: "active",
    unit_of_measure: "kit",
    metadata: { demo_seed: demoSeed, family: "filters", compatible_with: "AX-200" },
  },
  {
    id: "20000000-0000-4000-8000-000000000500",
    sku: "HX-500",
    name: "HX-500 Hydraulic Pump",
    description: "High-flow hydraulic pump for mining conveyors and crushers.",
    status: "active",
    unit_of_measure: "each",
    metadata: { demo_seed: demoSeed, family: "hydraulics" },
  },
  {
    id: "20000000-0000-4000-8000-000000000600",
    sku: "HX-500R",
    name: "HX-500R Hydraulic Pump Replacement Kit",
    description: "Drop-in replacement kit for discontinued HX-500 installations.",
    status: "active",
    unit_of_measure: "each",
    metadata: { demo_seed: demoSeed, family: "hydraulics", replaces: "HX-500" },
  },
  {
    id: "20000000-0000-4000-8000-000000000700",
    sku: "INST-STD",
    name: "Standard Installation Service",
    description: "Standard on-site installation and commissioning service.",
    status: "active",
    unit_of_measure: "service",
    metadata: { demo_seed: demoSeed, family: "services" },
  },
];

const productAliases = [
  ["20000000-0000-4000-8000-000000000200", "AX200", "customer_csv"],
  ["20000000-0000-4000-8000-000000000200", "Atlas actuator 200", "manual"],
  ["20000000-0000-4000-8000-000000000200", "AX-200 compressor equipment", "manual"],
  ["20000000-0000-4000-8000-000000000210", "AX-200 compatible filter kit", "manual"],
  ["20000000-0000-4000-8000-000000000210", "matching spare filters", "manual"],
  ["20000000-0000-4000-8000-000000000500", "HX500", "customer_csv"],
  ["20000000-0000-4000-8000-000000000500", "Northstar pump", "manual"],
  ["20000000-0000-4000-8000-000000000600", "HX-500 replacement", "manual"],
  ["20000000-0000-4000-8000-000000000700", "standard install", "manual"],
].map(([product_id, alias, source]) => ({ product_id, alias, source }));

const prices = [
  ["20000000-0000-4000-8000-000000000200", 1280, "2026-01-01", null],
  ["20000000-0000-4000-8000-000000000210", 145, "2026-01-01", null],
  ["20000000-0000-4000-8000-000000000500", 3425, "2026-01-01", "2026-09-30"],
  ["20000000-0000-4000-8000-000000000600", 3195, "2026-07-01", null],
  ["20000000-0000-4000-8000-000000000700", 650, "2026-01-01", null],
].map(([product_id, unit_price, effective_from, effective_to]) => ({
  product_id,
  currency_code: "USD",
  unit_price,
  effective_from,
  effective_to,
}));

const inventory = [
  ["20000000-0000-4000-8000-000000000200", "CHI-01", 12, 2, 4],
  ["20000000-0000-4000-8000-000000000200", "DAL-02", 8, 0, 3],
  ["20000000-0000-4000-8000-000000000210", "DAL-02", 20, 2, 5],
  ["20000000-0000-4000-8000-000000000500", "DEN-01", 3, 1, 2],
  ["20000000-0000-4000-8000-000000000500", "SEA-01", 4, 0, 2],
  ["20000000-0000-4000-8000-000000000600", "DEN-01", 6, 1, 2],
  ["20000000-0000-4000-8000-000000000600", "SEA-01", 5, 0, 2],
].map(([product_id, warehouse_code, quantity_on_hand, quantity_reserved, reorder_point]) => ({
  product_id,
  warehouse_code,
  quantity_on_hand,
  quantity_reserved,
  reorder_point,
}));

const discountPolicies = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    name: "Atlas volume discount",
    description: "Manufacturing customers receive automatic approval up to 8%; discounts through 15% require product-manager approval.",
    policy_type: "percent_off",
    discount_bps: 800,
    max_discount_bps: 1500,
    amount_off: 0,
    starts_on: "2026-01-01",
    ends_on: null,
    active: true,
    metadata: {
      demo_seed: demoSeed,
      customer_external_id: "DEMO-CUST-ATLAS",
      minimum_quantity: 1,
      automatic_approval_bps: 800,
      approval_required_above_bps: 800,
    },
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    name: "Northstar replacement incentive",
    description: "Mining customers receive a fixed credit when replacing HX-500 with HX-500R.",
    policy_type: "amount_off",
    discount_bps: 0,
    max_discount_bps: 0,
    amount_off: 250,
    starts_on: "2026-07-01",
    ends_on: "2026-12-31",
    active: true,
    metadata: {
      demo_seed: demoSeed,
      customer_external_id: "DEMO-CUST-NORTHSTAR",
      replacement_from: "HX-500",
      replacement_to: "HX-500R",
    },
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    name: "Standard installation bundle",
    description: "Installation is discounted 15% when bundled with equipment.",
    policy_type: "percent_off",
    discount_bps: 1500,
    max_discount_bps: 1500,
    amount_off: 0,
    starts_on: "2026-01-01",
    ends_on: null,
    active: true,
    metadata: { demo_seed: demoSeed, sku: "INST-STD", requires_equipment: true },
  },
];

const assertNoError = (label: string, error: { message: string } | null) => {
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
};

export type DemoActivityResetResult = {
  quotesDeleted: number;
  quoteItemsDeleted: number;
  approvalsDeleted: number;
  workflowEventsDeleted: number;
};

const zeroActivityResetResult = (): DemoActivityResetResult => ({
  quotesDeleted: 0,
  quoteItemsDeleted: 0,
  approvalsDeleted: 0,
  workflowEventsDeleted: 0,
});

const countRowsForQuotes = async (
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  table: "quote_items" | "approvals" | "workflow_events",
  label: string,
  quoteIds: string[],
) => {
  const { error, count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .in("quote_id", quoteIds);

  assertNoError(label, error);

  return count ?? 0;
};

export const clearDemoQuoteActivity = async (): Promise<DemoActivityResetResult> => {
  const supabase: ReturnType<typeof createAdminSupabaseClient> = createAdminSupabaseClient();

  const { data: quotes, error: quoteLookupError } = await supabase
    .from("quotes")
    .select("id");

  assertNoError("Find quote activity", quoteLookupError);

  const quoteIds = quotes?.map((quote: { id: string }) => quote.id) ?? [];

  if (quoteIds.length === 0) {
    return zeroActivityResetResult();
  }

  const [quoteItemsDeleted, approvalsDeleted, workflowEventsDeleted] = await Promise.all([
    countRowsForQuotes(supabase, "quote_items", "Count quote items for activity reset", quoteIds),
    countRowsForQuotes(supabase, "approvals", "Count approvals for activity reset", quoteIds),
    countRowsForQuotes(supabase, "workflow_events", "Count workflow events for activity reset", quoteIds),
  ]);

  const { error: deleteError, count: quotesDeleted } = await supabase
    .from("quotes")
    .delete({ count: "exact" })
    .in("id", quoteIds);

  assertNoError("Clear demo quote activity", deleteError);

  return {
    quotesDeleted: quotesDeleted ?? quoteIds.length,
    quoteItemsDeleted,
    approvalsDeleted,
    workflowEventsDeleted,
  };
};

export const resetDemoData = async () => {
  const supabase: ReturnType<typeof createAdminSupabaseClient> = createAdminSupabaseClient();
  const productIds = demoProducts.map((product) => product.id);
  const customerIds = demoCustomers.map((customer) => customer.id);
  const { data: demoOpportunities, error: opportunityLookupError } =
  await supabase
    .from("opportunities")
    .select("id")
    .in("customer_id", customerIds);

assertNoError(
  "Find demo opportunities",
  opportunityLookupError,
);

const opportunityIds =
  demoOpportunities?.map((opportunity: { id: string }) => opportunity.id) ?? [];

  const quoteFilters = [`metadata->>demo_seed.eq.${demoSeed}`, `customer_id.in.(${customerIds.join(",")})`];
  if (opportunityIds.length > 0) quoteFilters.push(`opportunity_id.in.(${opportunityIds.join(",")})`);
  const { data: demoQuotes, error: quoteLookupError } = await supabase
    .from("quotes")
    .select("id")
    .or(quoteFilters.join(","));
  assertNoError("Find demo quotes", quoteLookupError);
  const quoteIds = demoQuotes?.map((quote: { id: string }) => quote.id) ?? [];

  if (quoteIds.length > 0) {
    assertNoError("Delete demo workflow events", (await supabase.from("workflow_events").delete().in("quote_id", quoteIds)).error);
    assertNoError("Delete demo approvals", (await supabase.from("approvals").delete().in("quote_id", quoteIds)).error);
    assertNoError("Delete demo quote items", (await supabase.from("quote_items").delete().in("quote_id", quoteIds)).error);
    assertNoError("Delete demo quotes", (await supabase.from("quotes").delete().in("id", quoteIds)).error);
  }
  if (opportunityIds.length > 0) {
    assertNoError("Delete demo opportunities", (await supabase.from("opportunities").delete().in("id", opportunityIds)).error);
  }
  assertNoError("Delete demo prices", (await supabase.from("prices").delete().in("product_id", productIds)).error);
  assertNoError("Delete demo inventory", (await supabase.from("inventory").delete().in("product_id", productIds)).error);
  assertNoError("Delete demo aliases", (await supabase.from("product_aliases").delete().in("product_id", productIds)).error);
  assertNoError("Delete demo discount policies", (await supabase.from("discount_policies").delete().in("id", discountPolicies.map((policy) => policy.id))).error);
  assertNoError("Delete demo products", (await supabase.from("products").delete().in("id", productIds)).error);
  assertNoError("Delete demo customers", (await supabase.from("customers").delete().in("id", customerIds)).error);

  assertNoError("Insert demo customers", (await supabase.from("customers").insert(demoCustomers as never)).error);
  assertNoError("Insert demo products", (await supabase.from("products").insert(demoProducts as never)).error);
  assertNoError("Insert demo aliases", (await supabase.from("product_aliases").insert(productAliases as never)).error);
  assertNoError("Insert demo prices", (await supabase.from("prices").insert(prices as never)).error);
  assertNoError("Insert demo inventory", (await supabase.from("inventory").insert(inventory as never)).error);
  assertNoError("Insert demo discount policies", (await supabase.from("discount_policies").insert(discountPolicies as never)).error);

  return {
    customers: demoCustomers.length,
    products: demoProducts.length,
    productAliases: productAliases.length,
    prices: prices.length,
    inventory: inventory.length,
    discountPolicies: discountPolicies.length,
  };
};
