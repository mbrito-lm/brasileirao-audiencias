import { Redis } from "@upstash/redis";

// Histórico de acessos (logins) do sistema, guardado numa lista do Redis
// (Upstash / Vercel KV). É best-effort: se o storage não estiver configurado
// ou falhar, o login nunca é bloqueado por causa do log.

export interface AccessEntry {
  email: string;
  name?: string | null;
  ts: number; // epoch em ms
}

const KEY = "access:log";
const MAX = 1000; // mantém só os N acessos mais recentes

// Aceita tanto as env vars do Vercel KV (KV_REST_API_*) quanto as do
// Upstash (UPSTASH_REDIS_REST_*), dependendo de como o storage foi criado.
function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function accessLogConfigured(): boolean {
  return !!(
    (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL) &&
    (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

export async function recordAccess(email: string, name?: string | null): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const entry: AccessEntry = { email, name: name ?? null, ts: Date.now() };
    await redis.lpush(KEY, entry);
    await redis.ltrim(KEY, 0, MAX - 1);
  } catch {
    /* best-effort — nunca bloquear o login por causa do log */
  }
}

export async function getAccessLog(limit = 200): Promise<AccessEntry[]> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const raw = await redis.lrange<AccessEntry | string>(KEY, 0, limit - 1);
    return raw
      .map((r) => (typeof r === "string" ? (JSON.parse(r) as AccessEntry) : r))
      .filter((e): e is AccessEntry => !!e && typeof e.ts === "number");
  } catch {
    return [];
  }
}
