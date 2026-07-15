import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ?? new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

const SEARCH_TTL_SECONDS = 30;

/**
 * Cache des résultats de recherche (T2 / ADR-002). TTL court : la fraîcheur des disponibilités
 * prime sur le taux de cache-hit, l'invalidation explicite (invalidateSearchCache) couvre le reste.
 */
export async function getCachedSearch<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function setCachedSearch<T>(key: string, value: T): Promise<void> {
  await redis.set(key, JSON.stringify(value), "EX", SEARCH_TTL_SECONDS);
}

/**
 * Invalide tout le cache de recherche : appelé quand un coiffeur modifie ses créneaux (BF-09),
 * pour ne jamais exposer en recherche un créneau qui vient d'être retiré ou ajouté.
 */
export async function invalidateSearchCache(): Promise<void> {
  const keys = await redis.keys("search:*");
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
