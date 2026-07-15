import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { generateTotpSecret, totpQrCodeDataUrl, totpKeyUri, verifyTotpToken } from "@/lib/totp";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ message: "Session requise." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return NextResponse.json({ message: "Compte introuvable." }, { status: 404 });
  }

  if (user.totpEnabled) {
    return NextResponse.json({ alreadyEnabled: true });
  }

  let secret = user.totpSecret;
  if (!secret) {
    secret = generateTotpSecret();
    await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
  }

  return NextResponse.json({
    alreadyEnabled: false,
    manualKey: secret,
    qrDataUrl: await totpQrCodeDataUrl(user.email, secret),
    keyUri: totpKeyUri(user.email, secret),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ message: "Session requise." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const code = body && typeof body.code === "string" ? body.code : "";

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.totpSecret) {
    return NextResponse.json({ message: "Enrôlement non initialisé." }, { status: 400 });
  }

  if (!verifyTotpToken(code, user.totpSecret)) {
    return NextResponse.json({ message: "auth.error.invalidTotp" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
  session.mfaVerified = true;
  session.role = user.role;
  await session.save();

  return NextResponse.json({ ok: true, role: user.role });
}
