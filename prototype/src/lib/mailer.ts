import nodemailer from "nodemailer";

/**
 * Mailhog tient lieu de fournisseur SMS/Email tiers pour la démo (docker-compose). En production,
 * seul ce module changerait : le reste de l'application ne connaît que sendNotification()
 * (ADR-002 / ADR-007 — le fournisseur est un détail d'implémentation derrière une interface interne).
 */
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: false,
});

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  await transport.sendMail({
    from: "Salon RDV <no-reply@salon-rdv.example>",
    to,
    subject,
    text,
  });
}
