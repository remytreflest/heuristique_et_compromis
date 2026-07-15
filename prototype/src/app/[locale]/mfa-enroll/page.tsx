import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { EnrollForm } from "@/components/auth/EnrollForm";

export default async function MfaEnrollPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  return <EnrollForm locale={raw as Locale} />;
}
