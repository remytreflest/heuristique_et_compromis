import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body && typeof body.email === "string" ? body.email : "";
  const password = body && typeof body.password === "string" ? body.password : "";

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const valid = user ? await verifyPassword(password, user.passwordHash, user.passwordSalt) : false;

  if (!user || !valid) {
    // Message générique volontaire : ne pas indiquer si c'est l'email ou le mot de passe qui est
    // en cause (aucune fuite d'information sur l'existence d'un compte).
    return NextResponse.json({ message: "auth.error.invalidCredentials" }, { status: 401 });
  }

  const session = await getSession();

  if (!user.totpEnabled) {
    // Compte créé mais MFA jamais finalisé : on renvoie vers l'enrôlement plutôt que de bloquer.
    session.userId = user.id;
    session.role = user.role;
    session.mfaVerified = false;
    session.pendingMfaUserId = undefined;
    await session.save();
    return NextResponse.json({ ok: true, needsEnrollment: true });
  }

  session.pendingMfaUserId = user.id;
  session.userId = undefined;
  session.mfaVerified = false;
  await session.save();

  return NextResponse.json({ ok: true, needsMfa: true });
}
