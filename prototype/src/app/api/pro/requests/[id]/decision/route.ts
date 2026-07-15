import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { invalidateSearchCache } from "@/lib/redis";
import { notifyAsync } from "@/lib/notify";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession("COIFFEUR");
  if (!session) {
    return NextResponse.json({ message: "Session requise." }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const decision = body && (body.decision === "CONFIRM" || body.decision === "REFUSE") ? body.decision : null;
  if (!decision) {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { slot: true, client: true, service: true },
  });
  if (!appointment || appointment.slot.coiffeurId !== session.userId) {
    return NextResponse.json({ message: "Rendez-vous introuvable." }, { status: 404 });
  }
  if (appointment.status !== "PENDING") {
    return NextResponse.json({ message: "Cette demande a déjà été traitée." }, { status: 409 });
  }

  const newStatus = decision === "CONFIRM" ? "CONFIRMED" : "REFUSED";

  await prisma.appointment.update({ where: { id }, data: { status: newStatus } });

  if (decision === "REFUSE") {
    // Le créneau redevient disponible : le client est invité à reprendre une recherche (BF-10).
    await prisma.slot.update({ where: { id: appointment.slotId }, data: { status: "AVAILABLE" } });
    await invalidateSearchCache();
  }

  notifyAsync({
    appointmentId: appointment.id,
    toAddress: appointment.client.email,
    subject: decision === "CONFIRM" ? "Rendez-vous confirmé" : "Rendez-vous refusé",
    text:
      decision === "CONFIRM"
        ? `Votre rendez-vous du ${appointment.slot.start.toLocaleString("fr-FR")} est confirmé.`
        : `Votre demande du ${appointment.slot.start.toLocaleString("fr-FR")} a été refusée. Vous pouvez choisir un autre créneau.`,
  });

  return NextResponse.json({ ok: true, status: newStatus });
}
