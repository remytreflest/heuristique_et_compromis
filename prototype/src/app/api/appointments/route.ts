import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { notifyAsync } from "@/lib/notify";

export async function GET() {
  const session = await requireSession("CLIENT");
  if (!session) {
    return NextResponse.json({ message: "Session requise." }, { status: 401 });
  }

  const appointments = await prisma.appointment.findMany({
    where: { clientId: session.userId },
    include: { slot: { include: { coiffeur: true } }, service: true },
    orderBy: { slot: { start: "desc" } },
  });

  return NextResponse.json({
    appointments: appointments.map((a) => ({
      id: a.id,
      status: a.status,
      start: a.slot.start.toISOString(),
      serviceKey: a.service.key,
      coiffeurName: a.slot.coiffeur.name,
      coiffeurId: a.slot.coiffeurId,
      slotId: a.slotId,
    })),
  });
}

export async function POST(request: Request) {
  const session = await requireSession("CLIENT");
  if (!session) {
    return NextResponse.json({ message: "Session requise." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const slotId = body && typeof body.slotId === "string" ? body.slotId : "";
  const idempotencyKey = body && typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";

  if (!slotId || !idempotencyKey) {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  // Rejouer la même demande hors-ligne deux fois ne crée jamais deux rendez-vous (ADR-004).
  const existing = await prisma.appointment.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return NextResponse.json({ appointment: existing }, { status: 200 });
  }

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const slot = await tx.slot.findUnique({ where: { id: slotId }, include: { coiffeur: true, service: true } });
      if (!slot || slot.status !== "AVAILABLE") {
        throw new Error("SLOT_CONFLICT");
      }
      await tx.slot.update({ where: { id: slotId }, data: { status: "BOOKED" } });
      const appointment = await tx.appointment.create({
        data: {
          slotId,
          clientId: session.userId!,
          serviceId: slot.serviceId,
          status: "PENDING",
          idempotencyKey,
        },
      });
      return { appointment, slot };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SLOT_CONFLICT") {
      return NextResponse.json(
        { message: "booking.conflictBody" },
        { status: 409 }
      );
    }
    throw error;
  }

  const client = await prisma.user.findUnique({ where: { id: session.userId! } });
  if (client) {
    notifyAsync({
      appointmentId: created.appointment.id,
      toAddress: client.email,
      subject: "Demande de rendez-vous reçue",
      text: `Votre demande auprès de ${created.slot.coiffeur.name} le ${created.slot.start.toLocaleString("fr-FR")} a bien été reçue et est en attente de validation.`,
    });
  }
  notifyAsync({
    appointmentId: created.appointment.id,
    toAddress: created.slot.coiffeur.email,
    subject: "Nouvelle demande de rendez-vous",
    text: `Une nouvelle demande de rendez-vous (${created.slot.service.key}) attend votre validation.`,
  });

  return NextResponse.json({ appointment: created.appointment }, { status: 201 });
}
