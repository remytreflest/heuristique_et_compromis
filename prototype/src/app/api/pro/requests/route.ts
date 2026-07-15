import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";

export async function GET() {
  const session = await requireSession("COIFFEUR");
  if (!session) {
    return NextResponse.json({ message: "Session requise." }, { status: 401 });
  }

  const requests = await prisma.appointment.findMany({
    where: { status: "PENDING", slot: { coiffeurId: session.userId! } },
    include: { slot: true, service: true, client: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      start: r.slot.start.toISOString(),
      serviceKey: r.service.key,
      clientName: r.client.name,
    })),
  });
}
