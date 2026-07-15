import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/**
 * scrypt asynchrone (libuv threadpool) plutôt que scryptSync : mesuré sous charge (k6, 150 VUs
 * concurrents sur /api/auth/login) — la version synchrone bloque la boucle d'événements unique de
 * Node à chaque hachage, ce qui fait s'effondrer la latence de TOUTES les requêtes en cours dès
 * qu'un nombre significatif de connexions sont simultanées (voir performance/rapport-performance.md).
 */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return { hash: derived.toString("hex"), salt };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const candidate = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const stored = Buffer.from(hash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}
