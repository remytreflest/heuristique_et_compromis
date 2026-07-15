"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { translator, type Locale } from "@/lib/i18n";

const ROLE_HOME: Record<string, string> = {
  CLIENT: "",
  COIFFEUR: "pro/creneaux",
  GESTION: "pro/stats",
};

export function LoginForm({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCredentials(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(t(data.message ?? "auth.error.invalidCredentials"));
        return;
      }
      if (data.needsEnrollment) {
        router.push(`/${locale}/mfa-enroll`);
        return;
      }
      setStep("mfa");
    } catch {
      setError(t("common.offline"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfa(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(t(data.message ?? "auth.error.invalidTotp"));
        return;
      }
      const destination = ROLE_HOME[data.role as string] ?? "";
      router.push(`/${locale}/${destination}`);
      router.refresh();
    } catch {
      setError(t("common.offline"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="login-heading">
      <h1 id="login-heading">{t("auth.loginTitle")}</h1>

      {error && (
        <p className="error-banner" role="alert" aria-live="assertive">
          {error}
        </p>
      )}

      {step === "credentials" && (
        <form onSubmit={handleCredentials} noValidate>
          <label htmlFor="login-email">
            {t("auth.emailLabel")}
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label htmlFor="login-password">
            {t("auth.passwordLabel")}
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" disabled={submitting}>
            {t("auth.submitLogin")}
          </button>
        </form>
      )}

      {step === "mfa" && (
        <form onSubmit={handleMfa} noValidate>
          <p>{t("auth.mfaCodeLabel")}</p>
          <label htmlFor="login-mfa-code">
            {t("auth.mfaCodeLabel")}
            <input
              id="login-mfa-code"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button type="submit" disabled={submitting}>
            {t("auth.mfaSubmit")}
          </button>
        </form>
      )}
    </section>
  );
}
