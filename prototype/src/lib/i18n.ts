import fr from "@/messages/fr.json";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";

export const LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

const DICTIONARIES: Record<Locale, Record<string, string>> = { fr, en, ar };

// ADR-005 : la bascule RTL est un attribut, pas un gabarit dédié.
export const RTL_LOCALES: ReadonlySet<Locale> = new Set(["ar"]);

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Résout une clé de traduction. Une clé manquante affiche un repli explicite (la clé elle-même,
 * entre crochets) plutôt que de bloquer le rendu — critère d'acceptation BF-11.
 */
export function translator(locale: Locale) {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  return (key: string): string => dict[key] ?? `[${key}]`;
}
