import { describe, expect, it } from "vitest";

import { parseEnv, verifyLocalSupabaseEnv } from "../../scripts/verify-local-supabase-target.mjs";

describe("verifyLocalSupabaseEnv", () => {
  it("accepts local Supabase URLs and prints only host and port", () => {
    expect(verifyLocalSupabaseEnv(parseEnv("SUPABASE_URL=http://127.0.0.1:54321\nNEXT_PUBLIC_SUPABASE_URL=http://localhost:54321\nSUPABASE_SERVICE_ROLE_KEY=secret"))).toEqual(["SUPABASE_URL=127.0.0.1:54321", "NEXT_PUBLIC_SUPABASE_URL=localhost:54321"]);
  });

  it("rejects remote Supabase URLs", () => {
    expect(() => verifyLocalSupabaseEnv({ SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" })).toThrow(/remote project/);
  });

  it("does not include secrets in output", () => {
    const output = verifyLocalSupabaseEnv({ SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SERVICE_ROLE_KEY: "super-secret" }).join("\n");
    expect(output).not.toContain("super-secret");
  });
});
