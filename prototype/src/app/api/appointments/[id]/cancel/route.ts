import { NextResponse } from "next/server";
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

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { slot: { include: { coiffeur: true } } },
  });

  if (!appointment || appointment.clientId !== session.userId) {
    return NextResponse.json({ message: "Rendez-vous introuvable." }, { status: 404 });
  }
  if (appointment.status !== "PENDING" && appointment.status !== "CONFIRMED") {
    return NextResponse.json({ message: "Ce rendez-vous ne peut plus être annulé." }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.appointment.update({ where: { id }, data: { status: "CANCELLED" } }),
    prisma.slot.update({ where: { id: appointment.slotId }, data: { status: "AVAILABLE" } }),
  ]);
  await invalidateSearchCache();

  notifyAsync({
    appointmentId: appointment.id,
    toAddress: appointment.slot.coiffeur.email,
    subject: "Rendez-vous annulé par le client",
    text: `Le rendez-vous du ${appointment.slot.start.toLocaleString("fr-FR")} a été annulé par le client ; le créneau est de nouveau disponible.`,
  });

  return NextResponse.json({ ok: true });
}
