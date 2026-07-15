import { notFound, redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { SlotsManager } from "@/components/pro/SlotsManager";

export default async function ProCreneauxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  const session = await getSession();
  if (!session.userId || !session.mfaVerified || session.role !== "COIFFEUR") {
    redirect(`/${locale}/connexion`);
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });

  return <SlotsManager locale={locale} services={user?.services ?? []} />;
}
