import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { prisma } from "@/lib/db";
import { SearchClient } from "@/components/SearchClient";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  const services = await prisma.service.findMany({ orderBy: { key: "asc" } });

  return <SearchClient locale={locale} services={services.map((s) => s.key)} />;
}
