import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { verifyTotpToken } from "@/lib/totp";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.pendingMfaUserId) {
    return NextResponse.json({ message: "Aucune authentification en cours." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const code = body && typeof body.code === "string" ? body.code : "";

  const user = await prisma.user.findUnique({ where: { id: session.pendingMfaUserId } });
  if (!user?.totpSecret || !verifyTotpToken(code, user.totpSecret)) {
    // La saisie du premier facteur (email/mot de passe) n'est pas perdue : pendingMfaUserId reste
    // en session, l'utilisateur peut retenter uniquement le second facteur (critère BF-02).
    return NextResponse.json({ message: "auth.error.invalidTotp" }, { status: 401 });
  }

  session.userId = user.id;
  session.role = user.role;
  session.mfaVerified = true;
  session.pendingMfaUserId = undefined;
  await session.save();

  return NextResponse.json({ ok: true, role: user.role });
}
