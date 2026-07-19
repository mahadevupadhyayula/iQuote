import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv, verifyLocalSupabaseEnv } from "./verify-local-supabase-target.mjs";

const env = { ...process.env, ...parseEnv(readFileSync(resolve(process.cwd(), ".env.local"), "utf8")) };
for (const line of verifyLocalSupabaseEnv(env)) console.log(line);
if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for reset verification.");
const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const countRows = async (table) => {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
};
for (const table of ["quotes", "quote_items", "approvals", "workflow_events"]) {
  const count = await countRows(table);
  if (count !== 0) throw new Error(`${table} expected 0 rows after reset, found ${count}.`);
  console.log(`${table}=0`);
}
for (const table of ["products", "prices", "inventory", "discount_policies"]) {
  const count = await countRows(table);
  if (count <= 0) throw new Error(`${table} expected reference rows after reset.`);
  console.log(`${table}>0 (${count})`);
}
