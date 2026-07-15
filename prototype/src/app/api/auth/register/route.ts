import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const { role, name, email, password, salonId, languages, services } = body as Record<string, unknown>;

  if (
    (role !== "CLIENT" && role !== "COIFFEUR") ||
    typeof name !== "string" ||
    name.trim().length < 2 ||
    typeof email !== "string" ||
    !email.includes("@") ||
    typeof password !== "string" ||
    password.length < 8
  ) {
    return NextResponse.json({ message: "Champs invalides." }, { status: 400 });
  }

  if (role === "COIFFEUR") {
    if (typeof salonId !== "string" || !salonId) {
      return NextResponse.json({ message: "Salon requis." }, { status: 400 });
    }
    if (!Array.isArray(services) || services.length === 0) {
      return NextResponse.json({ message: "Au moins une prestation requise." }, { status: 400 });
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ message: "auth.error.emailTaken" }, { status: 409 });
  }

  const { hash, salt } = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      role,
      name: name.trim(),
      email,
      passwordHash: hash,
      passwordSalt: salt,
      languages: Array.isArray(languages) ? languages.filter((l) => typeof l === "string") : [],
      services: role === "COIFFEUR" && Array.isArray(services) ? services.filter((s) => typeof s === "string") : [],
      salonId: role === "COIFFEUR" ? (salonId as string) : null,
    },
  });

  const session = await getSession();
  session.userId = user.id;
  session.role = user.role;
  session.mfaVerified = false;
  await session.save();

  return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
}
