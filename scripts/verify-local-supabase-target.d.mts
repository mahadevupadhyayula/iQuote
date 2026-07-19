export function parseEnv(content: string): Record<string, string>;
export function isLocalSupabaseUrl(value: string): boolean;
export function verifyLocalSupabaseEnv(env: Record<string, string | undefined>): string[];
