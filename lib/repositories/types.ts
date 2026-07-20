import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";

export type RepositoryClient = SupabaseClient<Database>;

export type RepositoryError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export const isUniqueViolation = (error: RepositoryError | null) => error?.code === "23505";

export const throwRepositoryError = (operation: string, error: RepositoryError | null) => {
  if (error) {
    throw new Error(`${operation}: ${error.message}`);
  }
};
