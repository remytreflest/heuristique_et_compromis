import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { prisma } from "@/lib/db";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default async function InscriptionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  const [salons, services] = await Promise.all([
    prisma.salon.findMany({ orderBy: { name: "asc" } }),
    prisma.service.findMany({ orderBy: { key: "asc" } }),
  ]);

  return (
    <RegisterForm
      locale={locale}
      salons={salons.map((s) => ({ id: s.id, label: `${s.name} — ${s.city}` }))}
      services={services.map((s) => s.key)}
    />
  );
}
