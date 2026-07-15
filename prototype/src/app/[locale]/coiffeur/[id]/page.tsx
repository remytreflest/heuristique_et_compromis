import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, translator, type Locale } from "@/lib/i18n";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { BookingClient } from "@/components/BookingClient";

export default async function CoiffeurPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = translator(locale);

  const coiffeur = await prisma.user.findUnique({
    where: { id, role: "COIFFEUR" },
    include: {
      salon: true,
      slots: {
        where: { status: "AVAILABLE", start: { gte: new Date() } },
        include: { service: true },
        orderBy: { start: "asc" },
      },
    },
  });

  if (!coiffeur) notFound();

  const session = await getSession();
  const canBook = Boolean(session.userId && session.mfaVerified && session.role === "CLIENT");

  return (
    <section aria-labelledby="coiffeur-heading">
      <h1 id="coiffeur-heading">{coiffeur.name}</h1>
      <p>
        {coiffeur.salon?.name} — {coiffeur.salon?.city}
      </p>
      <p>{coiffeur.services.map((s) => t(`service.${s}`)).join(", ")}</p>

      <h2>{t("booking.slotsTitle")}</h2>

      {!canBook && (
        <p className="notice-banner">
          <Link href={`/${locale}/connexion`}>{t("nav.login")}</Link> — {t("auth.noAccount")}{" "}
          <Link href={`/${locale}/inscription`}>{t("nav.register")}</Link>
        </p>
      )}

      {canBook && (
        <BookingClient
          locale={locale}
          coiffeurName={coiffeur.name}
          slots={coiffeur.slots.map((slot) => ({
            id: slot.id,
            start: slot.start.toISOString(),
            serviceKey: slot.service.key,
          }))}
        />
      )}
    </section>
  );
}
