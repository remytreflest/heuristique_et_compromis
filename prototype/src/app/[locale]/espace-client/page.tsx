import { notFound, redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { getSession } from "@/lib/session";
import { AccountClient } from "@/components/AccountClient";

export default async function EspaceClientPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  const session = await getSession();
  if (!session.userId || !session.mfaVerified || session.role !== "CLIENT") {
    redirect(`/${locale}/connexion`);
  }

  return <AccountClient locale={locale} />;
}
