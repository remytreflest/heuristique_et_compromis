import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slots = await prisma.slot.findMany({
    where: { coiffeurId: id, status: "AVAILABLE", start: { gte: new Date() } },
    include: { service: true },
    orderBy: { start: "asc" },
  });

  return NextResponse.json({
    slots: slots.map((slot) => ({
      id: slot.id,
      start: slot.start.toISOString(),
      serviceKey: slot.service.key,
    })),
  });
}
