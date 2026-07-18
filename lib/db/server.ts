import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL environment variable.");
}

if (!supabaseAnonKey) {
  throw new Error("Missing SUPABASE_ANON_KEY environment variable.");
}

export const createServerSupabaseClient = () =>
  createClient<Database>(supabaseUrl, supabaseAnonKey);
