import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";

/**
 * BF-07 : envoi via une file asynchrone. Sans broker dédié (T7 — pas une brique de plus), la file
 * est simulée par un fire-and-forget côté serveur Node : l'appelant n'attend jamais l'envoi, donc un
 * échec ou une lenteur du fournisseur ne bloque ni ne fait échouer la réponse HTTP de réservation
 * (ADR-002). Un vrai déploiement remplacerait ce module par un producteur vers SQS / Service Bus,
 * sans changer l'appelant.
 */
export function notifyAsync(params: {
  appointmentId: string;
  toAddress: string;
  subject: string;
  text: string;
}): void {
  void (async () => {
    try {
      await sendMail(params.toAddress, params.subject, params.text);
      await prisma.notificationLog.create({
        data: {
          appointmentId: params.appointmentId,
          channel: "EMAIL",
          toAddress: params.toAddress,
          subject: params.subject,
        },
      });
    } catch (error) {
      console.error("[notify] échec d'envoi (sans impact sur le rendez-vous déjà confirmé)", error);
    }
  })();
}
