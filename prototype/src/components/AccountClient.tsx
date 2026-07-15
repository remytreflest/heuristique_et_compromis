"use client";

import { useCallback, useEffect, useState } from "react";
import { translator, type Locale } from "@/lib/i18n";
import { getQueue, syncQueue, type PendingAppointment } from "@/lib/offlineQueue";

interface Appointment {
  id: string;
  status: "PENDING" | "CONFIRMED" | "REFUSED" | "CANCELLED";
  start: string;
  serviceKey: string;
  coiffeurName: string;
  coiffeurId: string;
  slotId: string;
}

const STATUS_CLASS: Record<Appointment["status"], string> = {
  PENDING: "status-pending",
  CONFIRMED: "status-confirmed",
  REFUSED: "status-refused",
  CANCELLED: "status-cancelled",
};

const STATUS_KEY: Record<Appointment["status"], string> = {
  PENDING: "account.statusPending",
  CONFIRMED: "account.statusConfirmed",
  REFUSED: "account.statusRefused",
  CANCELLED: "account.statusCancelled",
};

export function AccountClient({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [queue, setQueue] = useState<PendingAppointment[]>([]);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<{ id: string; start: string; serviceKey: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setQueue(getQueue());
    try {
      const response = await fetch("/api/appointments");
      if (response.ok) {
        const data = await response.json();
        setAppointments(data.appointments ?? []);
      }
    } catch {
      // hors-ligne : on garde les dernières données affichées + la file locale.
    }
  }, []);

  useEffect(() => {
    refresh();
    const handleOnline = async () => {
      const outcome = await syncQueue();
      if (outcome.confirmed.length || outcome.conflicts.length) {
        setMessage(
          `${outcome.confirmed.length} synchronisé(s), ${outcome.conflicts.length} en conflit.`
        );
      }
      refresh();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [refresh]);

  async function handleSyncNow() {
    const outcome = await syncQueue();
    setMessage(`${outcome.confirmed.length} synchronisé(s), ${outcome.conflicts.length} en conflit.`);
    refresh();
  }

  async function handleCancel(id: string) {
    await fetch(`/api/appointments/${id}/cancel`, { method: "POST" });
    refresh();
  }

  async function openReschedule(appointment: Appointment) {
    setRescheduling(appointment.id);
    const response = await fetch(`/api/coiffeurs/${appointment.coiffeurId}/slots`);
    const data = await response.json();
    setAvailableSlots(data.slots ?? []);
  }

  async function submitReschedule(appointmentId: string, newSlotId: string) {
    const response = await fetch(`/api/appointments/${appointmentId}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newSlotId }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setMessage(t(body.message ?? "booking.conflictBody"));
    }
    setRescheduling(null);
    refresh();
  }

  const now = Date.now();
  const upcoming = appointments.filter(
    (a) => new Date(a.start).getTime() >= now && a.status !== "CANCELLED"
  );
  const past = appointments.filter(
    (a) => new Date(a.start).getTime() < now || a.status === "CANCELLED"
  );

  return (
    <section aria-labelledby="account-heading">
      <h1 id="account-heading">{t("account.title")}</h1>

      {message && (
        <p role="status" aria-live="polite" className="notice-banner">
          {message}
        </p>
      )}

      {queue.length > 0 && (
        <p className="notice-banner">
          {queue.length} demande(s) {t("account.statusPendingSync").toLowerCase()}.{" "}
          <button type="button" onClick={handleSyncNow}>
            {t("account.syncNow")}
          </button>
        </p>
      )}

      <h2>{t("account.upcoming")}</h2>
      {upcoming.length === 0 && queue.length === 0 && <p>{t("account.empty")}</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {queue.map((item) => (
          <li key={item.idempotencyKey} className="card">
            <span className="status-pill status-pending-sync">{t("account.statusPendingSync")}</span>
            <p>
              {item.serviceLabel} — {item.coiffeurName}
              <br />
              {new Date(item.start).toLocaleString(locale)}
            </p>
          </li>
        ))}
        {upcoming.map((appointment) => (
          <li key={appointment.id} className="card">
            <span className={`status-pill ${STATUS_CLASS[appointment.status]}`}>
              {t(STATUS_KEY[appointment.status])}
            </span>
            <p>
              {t(`service.${appointment.serviceKey}`)} — {appointment.coiffeurName}
              <br />
              {new Date(appointment.start).toLocaleString(locale)}
            </p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" className="secondary" onClick={() => handleCancel(appointment.id)}>
                {t("account.cancel")}
              </button>
              <button type="button" className="secondary" onClick={() => openReschedule(appointment)}>
                {t("account.reschedule")}
              </button>
            </div>
            {rescheduling === appointment.id && (
              <label htmlFor={`reschedule-${appointment.id}`}>
                {t("booking.slotLabel")}
                <select
                  id={`reschedule-${appointment.id}`}
                  defaultValue=""
                  onChange={(e) => e.target.value && submitReschedule(appointment.id, e.target.value)}
                >
                  <option value="" disabled>
                    {t("booking.chooseAnother")}
                  </option>
                  {availableSlots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {t(`service.${slot.serviceKey}`)} — {new Date(slot.start).toLocaleString(locale)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </li>
        ))}
      </ul>

      <h2>{t("account.past")}</h2>
      {past.length === 0 && <p>{t("account.empty")}</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {past.map((appointment) => (
          <li key={appointment.id} className="card">
            <span className={`status-pill ${STATUS_CLASS[appointment.status]}`}>
              {t(STATUS_KEY[appointment.status])}
            </span>
            <p>
              {t(`service.${appointment.serviceKey}`)} — {appointment.coiffeurName}
              <br />
              {new Date(appointment.start).toLocaleString(locale)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
