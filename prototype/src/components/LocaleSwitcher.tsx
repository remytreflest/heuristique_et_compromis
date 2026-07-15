"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALES, type Locale } from "@/lib/i18n";

const LABEL_KEY: Record<Locale, string> = {
  fr: "common.localeFr",
  en: "common.localeEn",
  ar: "common.localeAr",
};

export function LocaleSwitcher({
  currentLocale,
  labels,
}: {
  currentLocale: Locale;
  labels: Record<string, string>;
}) {
  const pathname = usePathname();
  const rest = pathname.split("/").slice(2).join("/");

  return (
    <nav className="locale-switcher" aria-label="Langue / Language / اللغة">
      {LOCALES.map((locale) => (
        <Link
          key={locale}
          href={`/${locale}/${rest}`}
          aria-current={locale === currentLocale ? "true" : undefined}
          lang={locale}
        >
          {labels[LABEL_KEY[locale]]}
        </Link>
      ))}
    </nav>
  );
}
