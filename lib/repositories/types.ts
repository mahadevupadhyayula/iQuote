import type { SupabaseClient } from "@supabase/supabase-js";

export type RepositoryClient = SupabaseClient<any>;

export type RepositoryError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export const throwRepositoryError = (operation: string, error: RepositoryError | null) => {
  if (error) {
    throw new Error(`${operation}: ${error.message}`);
  }
};
