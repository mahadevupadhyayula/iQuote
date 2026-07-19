import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const parseEnv = (content) => Object.fromEntries(content.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
  const index = line.indexOf("=");
  return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
}));
export const isLocalSupabaseUrl = (value) => {
  try {
    const url = new URL(value);
    return ["127.0.0.1", "localhost", "0.0.0.0", "::1", "[::1]"].includes(url.hostname) && url.port === "54321";
  } catch { return false; }
};
export const verifyLocalSupabaseEnv = (env) => ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"].map((name) => {
  const value = env[name];
  if (!value) throw new Error(`${name} is missing from .env.local.`);
  if (!isLocalSupabaseUrl(value)) throw new Error(`${name} must target local Supabase, not a remote project.`);
  const url = new URL(value);
  return `${name}=${url.hostname}:${url.port}`;
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = parseEnv(readFileSync(resolve(process.cwd(), ".env.local"), "utf8"));
  for (const line of verifyLocalSupabaseEnv(env)) console.log(line);
}
