import { notFound, redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { getSession } from "@/lib/session";
import { RequestsManager } from "@/components/pro/RequestsManager";

export default async function ProDemandesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  const session = await getSession();
  if (!session.userId || !session.mfaVerified || session.role !== "COIFFEUR") {
    redirect(`/${locale}/connexion`);
  }

  return <RequestsManager locale={locale} />;
}
