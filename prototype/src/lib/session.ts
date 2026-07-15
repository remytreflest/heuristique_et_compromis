import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export interface SessionData {
  userId?: string;
  role?: "CLIENT" | "COIFFEUR" | "GESTION";
  // Deuxième facteur validé ou non pour la session en cours (BF-02 / ADR-003).
  mfaVerified?: boolean;
  // Authentification en deux temps : identifiant en attente de vérification TOTP.
  pendingMfaUserId?: string;
}

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "dev-only-secret-change-me-please-32-chars",
  cookieName: "salon_rdv_session",
  cookieOptions: {
    // Piloté par COOKIE_SECURE (pas par NODE_ENV) : ce prototype docker-compose est servi en HTTP
    // simple, sans terminaison TLS. Un cookie marqué Secure sur une réponse HTTP est silencieusement
    // rejeté par tout client conforme aux specs (navigateurs, k6) — la session ne se serait jamais
    // maintenue. À positionner à "true" derrière un reverse-proxy HTTPS en production (C1).
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireSession(role?: SessionData["role"]) {
  const session = await getSession();
  if (!session.userId || !session.mfaVerified) {
    return null;
  }
  if (role && session.role !== role) {
    return null;
  }
  return session;
}
