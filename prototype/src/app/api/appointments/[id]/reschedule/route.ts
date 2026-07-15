import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { invalidateSearchCache } from "@/lib/redis";
import { notifyAsync } from "@/lib/notify";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession("CLIENT");
  if (!session) {
    return NextResponse.json({ message: "Session requise." }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const newSlotId = body && typeof body.newSlotId === "string" ? body.newSlotId : "";
  if (!newSlotId) {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { slot: { include: { coiffeur: true } } },
  });
  if (!appointment || appointment.clientId !== session.userId) {
    return NextResponse.json({ message: "Rendez-vous introuvable." }, { status: 404 });
  }
  if (appointment.status !== "PENDING" && appointment.status !== "CONFIRMED") {
    return NextResponse.json({ message: "Ce rendez-vous ne peut plus être reporté." }, { status: 409 });
  }

  try {
    // Opération atomique (BF-06) : annulation de l'ancien + création du nouveau dans la même
    // transaction, pour qu'aucun état intermédiaire « sans rendez-vous » ne soit jamais visible.
    const result = await prisma.$transaction(async (tx) => {
      const newSlot = await tx.slot.findUnique({ where: { id: newSlotId } });
      if (!newSlot || newSlot.status !== "AVAILABLE") {
        throw new Error("SLOT_CONFLICT");
      }
      await tx.slot.update({ where: { id: appointment.slotId }, data: { status: "AVAILABLE" } });
      await tx.appointment.update({ where: { id }, data: { status: "CANCELLED" } });
      await tx.slot.update({ where: { id: newSlotId }, data: { status: "BOOKED" } });
      const created = await tx.appointment.create({
        data: {
          slotId: newSlotId,
          clientId: session.userId!,
          serviceId: newSlot.serviceId,
          status: "PENDING",
          idempotencyKey: randomUUID(),
        },
      });
      return created;
    });

    await invalidateSearchCache();
    notifyAsync({
      appointmentId: result.id,
      toAddress: appointment.slot.coiffeur.email,
      subject: "Rendez-vous reporté par le client",
      text: `Le rendez-vous du ${appointment.slot.start.toLocaleString("fr-FR")} a été reporté par le client.`,
    });

    return NextResponse.json({ appointment: result });
  } catch (error) {
    if (error instanceof Error && error.message === "SLOT_CONFLICT") {
      return NextResponse.json({ message: "booking.conflictBody" }, { status: 409 });
    }
    throw error;
  }
}
