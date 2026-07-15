import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { invalidateSearchCache } from "@/lib/redis";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession("COIFFEUR");
  if (!session) {
    return NextResponse.json({ message: "Session requise." }, { status: 401 });
  }
  const { id } = await params;

  const slot = await prisma.slot.findUnique({ where: { id } });
  if (!slot || slot.coiffeurId !== session.userId) {
    return NextResponse.json({ message: "Créneau introuvable." }, { status: 404 });
  }
  if (slot.status !== "AVAILABLE") {
    return NextResponse.json({ message: "Un créneau réservé ne peut pas être retiré." }, { status: 409 });
  }

  await prisma.slot.delete({ where: { id } });
  // Retrait immédiat du cache de recherche : ne jamais exposer un créneau qui vient d'être retiré (BF-09).
  await invalidateSearchCache();

  return NextResponse.json({ ok: true });
}
