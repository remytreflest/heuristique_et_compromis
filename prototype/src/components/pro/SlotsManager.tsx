"use client";

import { useEffect, useState } from "react";
import { translator, type Locale } from "@/lib/i18n";

interface SlotView {
  id: string;
  start: string;
  status: "AVAILABLE" | "BOOKED";
  serviceKey: string;
}

export function SlotsManager({ locale, services }: { locale: Locale; services: string[] }) {
  const t = translator(locale);
  const [slots, setSlots] = useState<SlotView[]>([]);
  const [serviceKey, setServiceKey] = useState(services[0] ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/pro/slots");
    const data = await response.json();
    setSlots(data.slots ?? []);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!date || !serviceKey) return;
    const start = new Date(`${date}T${time}:00`);
    const response = await fetch("/api/pro/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceKey, start: start.toISOString() }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setMessage(body.message ?? "Erreur");
      return;
    }
    refresh();
  }

  async function handleRemove(id: string) {
    const response = await fetch(`/api/pro/slots/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setMessage(body.message ?? "Erreur");
      return;
    }
    refresh();
  }

  return (
    <section aria-labelledby="pro-slots-heading">
      <h1 id="pro-slots-heading">{t("pro.slotsTitle")}</h1>

      {message && (
        <p className="error-banner" role="alert" aria-live="assertive">
          {message}
        </p>
      )}

      <form onSubmit={handleAdd}>
        <label htmlFor="slot-service">
          {t("search.serviceLabel")}
          <select id="slot-service" value={serviceKey} onChange={(e) => setServiceKey(e.target.value)}>
            {services.map((key) => (
              <option key={key} value={key}>
                {t(`service.${key}`)}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="slot-date">
          Date
          <input id="slot-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label htmlFor="slot-time">
          Heure
          <input id="slot-time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <button type="submit">{t("pro.addSlot")}</button>
      </form>

      <ul className="slots-grid">
        {slots.map((slot) => (
          <li key={slot.id}>
            <p>
              <strong>{t(`service.${slot.serviceKey}`)}</strong>
              <br />
              {new Date(slot.start).toLocaleString(locale)}
              <br />
              <span className={`status-pill ${slot.status === "AVAILABLE" ? "status-confirmed" : "status-pending"}`}>
                {slot.status === "AVAILABLE" ? t("pro.slotAvailable") : t("pro.slotBooked")}
              </span>
            </p>
            {slot.status === "AVAILABLE" && (
              <button type="button" className="secondary" onClick={() => handleRemove(slot.id)}>
                {t("pro.removeSlot")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
