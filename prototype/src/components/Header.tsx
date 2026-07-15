import Link from "next/link";
import { getSession } from "@/lib/session";
import { translator, type Locale } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { LogoutButton } from "@/components/LogoutButton";
import fr from "@/messages/fr.json";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";

const ALL_MESSAGES: Record<Locale, Record<string, string>> = { fr, en, ar };

export async function Header({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const session = await getSession();
  const loggedIn = Boolean(session.userId && session.mfaVerified);

  return (
    <header className="header">
      <div className="container">
        <nav aria-label={t("common.appName")}>
          <Link href={`/${locale}`} className="app-name">
            {t("common.appName")}
          </Link>
          <Link href={`/${locale}`}>{t("nav.search")}</Link>

          {loggedIn && session.role === "CLIENT" && (
            <>
              <Link href={`/${locale}/espace-client`}>{t("nav.myAccount")}</Link>
              <Link href={`/${locale}/assistant`}>{t("nav.assistant")}</Link>
            </>
          )}

          {loggedIn && session.role === "COIFFEUR" && (
            <>
              <Link href={`/${locale}/pro/creneaux`}>{t("nav.proSlots")}</Link>
              <Link href={`/${locale}/pro/demandes`}>{t("nav.proRequests")}</Link>
            </>
          )}

          {loggedIn && session.role === "GESTION" && (
            <Link href={`/${locale}/pro/stats`}>{t("nav.proStats")}</Link>
          )}

          {!loggedIn && (
            <>
              <Link href={`/${locale}/connexion`}>{t("nav.login")}</Link>
              <Link href={`/${locale}/inscription`}>{t("nav.register")}</Link>
            </>
          )}

          {loggedIn && <LogoutButton locale={locale} label={t("nav.logout")} />}

          <LocaleSwitcher currentLocale={locale} labels={ALL_MESSAGES[locale]} />
        </nav>
      </div>
    </header>
  );
}
