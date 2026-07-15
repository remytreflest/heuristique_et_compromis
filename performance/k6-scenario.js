// Scénario de charge réel (k6) contre le prototype docker-compose déjà démarré.
// Rejoue les deux parcours critiques identifiés en C2 : la recherche (le trafic dominant lors
// d'un pic) et la réservation (le sous-ensemble qui va au bout d'une transaction), sur le scénario
// explicitement cité par le brief — « ouverture des créneaux avant les fêtes de fin d'année ».
//
// Lancement : voir performance/rapport-performance.md.

import http from "k6/http";
import crypto from "k6/crypto";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const DEMO_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
const SERVICES = ["coupe", "coloration", "brushing"];
const CITIES = ["Lyon", "Paris", "Marseille", ""];
const LANGS = ["fr", "en", "ar", ""];

export const bookingConfirmed = new Counter("booking_confirmed");
export const bookingConflict = new Counter("booking_conflict");
export const bookingError = new Counter("booking_error");
export const bookingDuration = new Trend("booking_duration_ms");

// --- TOTP (RFC 6238), implémenté avec k6/crypto : voir la vérification manuelle dans
// performance/rapport-performance.md (algorithme validé contre otplib avant exécution).
function base32Decode(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of base32.replace(/=+$/, "")) {
    const val = alphabet.indexOf(char.toUpperCase());
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

function intToBytes(num) {
  const bytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    bytes[i] = num & 0xff;
    num = Math.floor(num / 256);
  }
  return bytes;
}

function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return bytes;
}

function totp(secretBase32) {
  const key = base32Decode(secretBase32).buffer;
  const counter = Math.floor(Date.now() / 1000 / 30);
  const data = intToBytes(counter).buffer;
  const hmacHex = crypto.hmac("sha1", key, data, "hex");
  const hmac = hexToBytes(hmacHex);
  const offset = hmac[19] & 0xf;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binCode % 1000000).padStart(6, "0");
}

function login(email) {
  const jar = http.cookieJar();
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password: "Demo1234!" }),
    { headers: { "Content-Type": "application/json" }, jar }
  );
  if (loginRes.status !== 200) return null;
  const mfaRes = http.post(
    `${BASE_URL}/api/auth/mfa/verify`,
    JSON.stringify({ code: totp(DEMO_TOTP_SECRET) }),
    { headers: { "Content-Type": "application/json" }, jar }
  );
  return mfaRes.status === 200 ? jar : null;
}

export const options = {
  scenarios: {
    // Trafic dominant d'un pic (C2) : consultation/recherche, non authentifiée, assistée par le
    // cache Redis (ADR-002). Cible littérale du brief : 500 utilisateurs simultanés.
    recherche: {
      executor: "ramping-vus",
      exec: "searchScenario",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 500 },
        { duration: "30s", target: 500 },
        { duration: "10s", target: 0 },
      ],
    },
    // Sous-ensemble qui va au bout d'une réservation, en rafale sur un pool volontairement limité
    // de créneaux — modélise « l'ouverture des créneaux avant les fêtes » : forte contention sur un
    // stock fini, où la majorité des requêtes tardives doivent échouer proprement (409), sans
    // jamais produire de double réservation (ADR-004).
    reservation_burst: {
      executor: "ramping-vus",
      exec: "bookingScenario",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 150 },
        { duration: "15s", target: 150 },
        { duration: "5s", target: 0 },
      ],
      startTime: "25s",
    },
  },
  thresholds: {
    // Exigence C2 du brief : temps de réponse < 2s.
    "http_req_duration{scenario:recherche}": ["p(95)<2000"],
    "http_req_duration{scenario:reservation_burst}": ["p(95)<2000"],
    http_req_failed: ["rate<0.01"],
  },
};

export function setup() {
  const jar = login("coiffeur1@example.com");
  if (!jar) {
    throw new Error("Impossible de s'authentifier en tant que coiffeur pour préparer le pool de créneaux.");
  }

  const slotIds = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + 30);
  baseDate.setHours(8, 0, 0, 0);

  const SLOT_COUNT = 40;
  for (let i = 0; i < SLOT_COUNT; i += 1) {
    const start = new Date(baseDate.getTime() + i * 15 * 60 * 1000);
    const res = http.post(
      `${BASE_URL}/api/pro/slots`,
      JSON.stringify({ serviceKey: SERVICES[i % SERVICES.length], start: start.toISOString() }),
      { headers: { "Content-Type": "application/json" }, jar }
    );
    if (res.status === 201) {
      slotIds.push(JSON.parse(res.body).slot.id);
    }
  }

  return { slotIds };
}

export function searchScenario() {
  const service = SERVICES[Math.floor(Math.random() * SERVICES.length)];
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  const lang = LANGS[Math.floor(Math.random() * LANGS.length)];
  // k6 (goja) n'expose pas URLSearchParams globalement : construction manuelle de la query string.
  const params = `service=${encodeURIComponent(service)}&city=${encodeURIComponent(city)}&lang=${encodeURIComponent(lang)}`;

  const res = http.get(`${BASE_URL}/api/search?${params}`, {
    tags: { scenario: "recherche" },
  });

  check(res, {
    "recherche: 200": (r) => r.status === 200,
    "recherche: résultats présents": (r) => {
      try {
        return Array.isArray(JSON.parse(r.body).results);
      } catch {
        return false;
      }
    },
  });

  sleep(Math.random() * 1.5);
}

export function bookingScenario(data) {
  const jar = login("client@example.com");
  if (!jar) {
    bookingError.add(1);
    return;
  }

  const slotId = data.slotIds[Math.floor(Math.random() * data.slotIds.length)];
  const idempotencyKey = `k6-${__VU}-${__ITER}-${Date.now()}`;

  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/appointments`,
    JSON.stringify({ slotId, idempotencyKey }),
    { headers: { "Content-Type": "application/json" }, jar, tags: { scenario: "reservation_burst" } }
  );
  bookingDuration.add(Date.now() - start);

  if (res.status === 201 || res.status === 200) {
    bookingConfirmed.add(1);
  } else if (res.status === 409) {
    bookingConflict.add(1);
  } else {
    bookingError.add(1);
  }

  check(res, {
    "reservation: statut attendu (confirmé ou conflit propre)": (r) =>
      r.status === 201 || r.status === 200 || r.status === 409,
    "reservation: jamais d'erreur serveur": (r) => r.status < 500,
  });

  sleep(Math.random());
}
