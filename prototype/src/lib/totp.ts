import { authenticator } from "otplib";
import QRCode from "qrcode";

const ISSUER = "Salon RDV";

/**
 * WebAuthn/passkey reste la cible principale de MFA (ADR-003) ; TOTP est le mécanisme rendu
 * fonctionnel dans ce prototype car il ne dépend d'aucun matériel spécifique et reste entièrement
 * pilotable au clavier (saisie manuelle du code), contrairement à un flux WebAuthn qui exige une
 * interaction plateforme (Touch ID, clé de sécurité...) impossible à démontrer de façon fiable en
 * conteneur. Voir prototype/README.md pour la trajectoire d'activation de WebAuthn.
 */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function totpKeyUri(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export async function totpQrCodeDataUrl(email: string, secret: string): Promise<string> {
  return QRCode.toDataURL(totpKeyUri(email, secret));
}

export function verifyTotpToken(token: string, secret: string): boolean {
  try {
    return authenticator.check(token, secret);
  } catch {
    return false;
  }
}
