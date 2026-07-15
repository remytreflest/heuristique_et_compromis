"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { translator, LOCALES, type Locale } from "@/lib/i18n";

export function RegisterForm({
  locale,
  salons,
  services,
}: {
  locale: Locale;
  salons: { id: string; label: string }[];
  services: string[];
}) {
  const t = translator(locale);
  const router = useRouter();

  const [role, setRole] = useState<"CLIENT" | "COIFFEUR">("CLIENT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [salonId, setSalonId] = useState(salons[0]?.id ?? "");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(["fr"]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggle(list: string[], value: string, setter: (v: string[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          name,
          email,
          password,
          languages,
          ...(role === "COIFFEUR" ? { salonId, services: selectedServices } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(t(data.message ?? "auth.error.emailTaken"));
        return;
      }
      router.push(`/${locale}/mfa-enroll`);
    } catch {
      setError(t("common.offline"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="register-heading">
      <h1 id="register-heading">{t("auth.registerTitle")}</h1>

      {error && (
        <p className="error-banner" role="alert" aria-live="assertive">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <fieldset>
          <legend>{t("auth.roleLabel")}</legend>
          <label htmlFor="role-client" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
            <input
              id="role-client"
              type="radio"
              name="role"
              checked={role === "CLIENT"}
              onChange={() => setRole("CLIENT")}
            />
            {t("auth.roleClient")}
          </label>
          <label htmlFor="role-coiffeur" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
            <input
              id="role-coiffeur"
              type="radio"
              name="role"
              checked={role === "COIFFEUR"}
              onChange={() => setRole("COIFFEUR")}
            />
            {t("auth.roleCoiffeur")}
          </label>
        </fieldset>

        <label htmlFor="register-name">
          {t("auth.nameLabel")}
          <input id="register-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label htmlFor="register-email">
          {t("auth.emailLabel")}
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label htmlFor="register-password">
          {t("auth.passwordLabel")}
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <fieldset>
          <legend>{t("auth.languagesLabel")}</legend>
          {LOCALES.map((l) => (
            <label key={l} htmlFor={`lang-${l}`} style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
              <input
                id={`lang-${l}`}
                type="checkbox"
                checked={languages.includes(l)}
                onChange={() => toggle(languages, l, setLanguages)}
              />
              {t(`common.locale${l[0].toUpperCase()}${l.slice(1)}`)}
            </label>
          ))}
        </fieldset>

        {role === "COIFFEUR" && (
          <>
            <label htmlFor="register-salon">
              {t("auth.salonLabel")}
              <select id="register-salon" value={salonId} onChange={(e) => setSalonId(e.target.value)} required>
                {salons.map((salon) => (
                  <option key={salon.id} value={salon.id}>
                    {salon.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend>{t("auth.servicesLabel")}</legend>
              {services.map((key) => (
                <label key={key} htmlFor={`service-${key}`} style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    id={`service-${key}`}
                    type="checkbox"
                    checked={selectedServices.includes(key)}
                    onChange={() => toggle(selectedServices, key, setSelectedServices)}
                  />
                  {t(`service.${key}`)}
                </label>
              ))}
            </fieldset>
          </>
        )}

        <button type="submit" disabled={submitting}>
          {t("auth.submitRegister")}
        </button>
      </form>
    </section>
  );
}
