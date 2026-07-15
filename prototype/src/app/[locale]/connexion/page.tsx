import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function ConnexionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  return <LoginForm locale={raw as Locale} />;
}
