"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { translator, type Locale } from "@/lib/i18n";

interface EnrollData {
  alreadyEnabled: boolean;
  manualKey?: string;
  qrDataUrl?: string;
}

const ROLE_HOME: Record<string, string> = {
  CLIENT: "",
  COIFFEUR: "pro/creneaux",
  GESTION: "pro/stats",
};

export function EnrollForm({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const router = useRouter();
  const [data, setData] = useState<EnrollData | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/mfa/enroll")
      .then((res) => {
        if (res.status === 401) {
          router.push(`/${locale}/connexion`);
          return null;
        }
        return res.json();
      })
      .then((body) => {
        if (body) setData(body);
      });
  }, [locale, router]);

  async function handleConfirm(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/mfa/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(t(body.message ?? "auth.error.invalidTotp"));
        return;
      }
      const destination = ROLE_HOME[body.role as string] ?? "";
      router.push(`/${locale}/${destination}`);
      router.refresh();
    } catch {
      setError(t("common.offline"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!data) {
    return <p aria-live="polite">…</p>;
  }

  if (data.alreadyEnabled) {
    return <p>{t("auth.mfaEnrollTitle")} — déjà activée.</p>;
  }

  return (
    <section aria-labelledby="enroll-heading">
      <h1 id="enroll-heading">{t("auth.mfaEnrollTitle")}</h1>
      <p>{t("auth.mfaEnrollInstructions")}</p>

      {data.qrDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.qrDataUrl} alt={`${t("auth.mfaEnrollManualKey")}: ${data.manualKey}`} width={200} height={200} />
      )}

      <p>
        <strong>{t("auth.mfaEnrollManualKey")}:</strong> <code>{data.manualKey}</code>
      </p>

      {error && (
        <p className="error-banner" role="alert" aria-live="assertive">
          {error}
        </p>
      )}

      <form onSubmit={handleConfirm} noValidate>
        <label htmlFor="enroll-code">
          {t("auth.mfaCodeLabel")}
          <input
            id="enroll-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {t("auth.mfaEnrollConfirm")}
        </button>
      </form>
    </section>
  );
}
