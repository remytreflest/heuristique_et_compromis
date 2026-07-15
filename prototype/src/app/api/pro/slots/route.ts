import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { invalidateSearchCache } from "@/lib/redis";

export async function GET() {
  const session = await requireSession("COIFFEUR");
  if (!session) {
    return NextResponse.json({ message: "Session requise." }, { status: 401 });
  }

  const slots = await prisma.slot.findMany({
    where: { coiffeurId: session.userId },
    include: { service: true },
    orderBy: { start: "asc" },
  });

  return NextResponse.json({
    slots: slots.map((slot) => ({
      id: slot.id,
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      status: slot.status,
      serviceKey: slot.service.key,
    })),
  });
}

export async function POST(request: Request) {
  const session = await requireSession("COIFFEUR");
  if (!session) {
    return NextResponse.json({ message: "Session requise." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const serviceKey = body && typeof body.serviceKey === "string" ? body.serviceKey : "";
  const start = body && typeof body.start === "string" ? new Date(body.start) : null;

  if (!serviceKey || !start || Number.isNaN(start.getTime())) {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const service = await prisma.service.findUnique({ where: { key: serviceKey } });
  if (!service) {
    return NextResponse.json({ message: "Prestation inconnue." }, { status: 400 });
  }

  const end = new Date(start.getTime() + 45 * 60 * 1000);

  const slot = await prisma.slot.create({
    data: { coiffeurId: session.userId!, serviceId: service.id, start, end, status: "AVAILABLE" },
  });

  // Rend immédiatement le nouveau créneau visible en recherche (BF-09 / ADR-002).
  await invalidateSearchCache();

  return NextResponse.json({ slot }, { status: 201 });
}
