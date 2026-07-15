import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dirFor, isLocale, translator, type Locale } from "@/lib/i18n";
import { Header } from "@/components/Header";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Salon RDV",
  description: "Prototype accessible de prise de rendez-vous en salon de coiffure",
  manifest: "/manifest.json",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) {
    notFound();
  }
  const locale = rawLocale as Locale;
  const t = translator(locale);

  return (
    <html lang={locale} dir={dirFor(locale)}>
      <body>
        <a className="skip-link" href="#main">
          {locale === "ar" ? "تجاوز إلى المحتوى" : locale === "en" ? "Skip to content" : "Aller au contenu"}
        </a>
        <Header locale={locale} />
        <main id="main" className="container" tabIndex={-1}>
          {children}
        </main>
        <ServiceWorkerRegister />
        <footer className="container" style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
          {t("common.appName")} — prototype pédagogique, données fictives.
        </footer>
      </body>
    </html>
  );
}
