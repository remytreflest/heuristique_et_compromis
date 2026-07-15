"use client";

import { useEffect, useState } from "react";
import { translator, type Locale } from "@/lib/i18n";

interface RequestView {
  id: string;
  start: string;
  serviceKey: string;
  clientName: string;
}

export function RequestsManager({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const [requests, setRequests] = useState<RequestView[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/pro/requests");
    const data = await response.json();
    setRequests(data.requests ?? []);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function decide(id: string, decision: "CONFIRM" | "REFUSE") {
    const response = await fetch(`/api/pro/requests/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setMessage(body.message ?? "Erreur");
      return;
    }
    refresh();
  }

  return (
    <section aria-labelledby="pro-requests-heading">
      <h1 id="pro-requests-heading">{t("pro.requestsTitle")}</h1>

      {message && (
        <p className="error-banner" role="alert" aria-live="assertive">
          {message}
        </p>
      )}

      {requests.length === 0 ? (
        <p>{t("pro.noRequests")}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {requests.map((request) => (
            <li key={request.id} className="card">
              <p>
                <strong>{request.clientName}</strong> — {t(`service.${request.serviceKey}`)}
                <br />
                {new Date(request.start).toLocaleString(locale)}
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" onClick={() => decide(request.id, "CONFIRM")}>
                  {t("pro.validate")}
                </button>
                <button type="button" className="secondary" onClick={() => decide(request.id, "REFUSE")}>
                  {t("pro.refuse")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
