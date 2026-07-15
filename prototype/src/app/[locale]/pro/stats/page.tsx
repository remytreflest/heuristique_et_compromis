import { notFound, redirect } from "next/navigation";
import { isLocale, translator, type Locale } from "@/lib/i18n";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

const K_ANONYMITY_THRESHOLD = 5;

export default async function ProStatsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = translator(locale);

  const session = await getSession();
  if (!session.userId || !session.mfaVerified || session.role !== "GESTION") {
    redirect(`/${locale}/connexion`);
  }

  const appointments = await prisma.appointment.findMany({
    where: { status: "CONFIRMED" },
    include: { service: true, slot: { include: { coiffeur: { include: { salon: true } } } } },
  });

  // Agrégation en mémoire (jeu de données de démo) — jamais par client identifié (ADR-006).
  const groups = new Map<string, { salonName: string; serviceKey: string; count: number }>();
  for (const appointment of appointments) {
    const salonName = appointment.slot.coiffeur.salon?.name ?? "—";
    const serviceKey = appointment.service.key;
    const key = `${salonName}|${serviceKey}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { salonName, serviceKey, count: 1 });
    }
  }

  const rows = [...groups.values()]
    .filter((row) => row.count >= K_ANONYMITY_THRESHOLD)
    .sort((a, b) => b.count - a.count);
  const suppressedCount = groups.size - rows.length;

  return (
    <section aria-labelledby="stats-heading">
      <h1 id="stats-heading">{t("pro.statsTitle")}</h1>
      <p>{t("pro.statsThreshold")}</p>

      <table>
        <caption className="sr-only">{t("pro.statsTitle")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("auth.salonLabel")}</th>
            <th scope="col">{t("search.serviceLabel")}</th>
            <th scope="col">{t("account.statusConfirmed")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.salonName}-${row.serviceKey}`}>
              <td>{row.salonName}</td>
              <td>{t(`service.${row.serviceKey}`)}</td>
              <td>{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {suppressedCount > 0 && (
        <p className="notice-banner">
          {suppressedCount} regroupement(s) sous le seuil de {K_ANONYMITY_THRESHOLD} ne sont pas affichés.
        </p>
      )}
    </section>
  );
}
