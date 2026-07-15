"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { translator, type Locale } from "@/lib/i18n";
import type { SearchResult } from "@/app/api/search/route";

export function SearchClient({
  locale,
  services,
}: {
  locale: Locale;
  services: string[];
}) {
  const t = translator(locale);
  const [service, setService] = useState("");
  const [city, setCity] = useState("");
  const [lang, setLang] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    try {
      const params = new URLSearchParams();
      if (service) params.set("service", service);
      if (city) params.set("city", city);
      if (lang) params.set("lang", lang);
      const response = await fetch(`/api/search?${params.toString()}`);
      const data = await response.json();
      setResults(data.results ?? []);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [service, city, lang]);

  useEffect(() => {
    runSearch();
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      runSearch();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    runSearch();
  }

  return (
    <section aria-labelledby="search-heading">
      <h1 id="search-heading">{t("search.title")}</h1>

      <form onSubmit={handleSubmit} role="search">
        <label htmlFor="search-service">
          {t("search.serviceLabel")}
          <select id="search-service" value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">{t("search.serviceAny")}</option>
            {services.map((key) => (
              <option key={key} value={key}>
                {t(`service.${key}`)}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="search-city">
          {t("search.locationLabel")}
          <input
            id="search-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t("search.locationPlaceholder")}
          />
        </label>

        <label htmlFor="search-lang">
          {t("search.languageLabel")}
          <select id="search-lang" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="">{t("search.languageAny")}</option>
            <option value="fr">{t("common.localeFr")}</option>
            <option value="en">{t("common.localeEn")}</option>
            <option value="ar">{t("common.localeAr")}</option>
          </select>
        </label>

        <button type="submit">{t("search.submit")}</button>
      </form>

      {offline && (
        <p className="notice-banner" role="status" aria-live="polite">
          {t("search.cachedNotice")}
        </p>
      )}

      <h2>{t("search.resultsHeading")}</h2>
      <div aria-live="polite">
        {loading && <p>…</p>}
        {!loading && results && results.length === 0 && <p>{t("search.noResults")}</p>}
        {!loading && results && results.length > 0 && (
          <ul className="slots-grid" style={{ listStyle: "none", padding: 0 }}>
            {results.map((coiffeur) => (
              <li key={coiffeur.id} className="card">
                <h3>{coiffeur.name}</h3>
                <p>
                  {coiffeur.salonName} — {coiffeur.city}
                </p>
                <p>{coiffeur.services.map((s) => t(`service.${s}`)).join(", ")}</p>
                <Link href={`/${locale}/coiffeur/${coiffeur.id}`}>{t("search.book")}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
