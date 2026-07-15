"use client";

import { useState } from "react";
import Link from "next/link";
import { translator, type Locale } from "@/lib/i18n";
import { bookSlot } from "@/lib/offlineQueue";

interface SlotView {
  id: string;
  start: string;
  serviceKey: string;
}

export function BookingClient({
  locale,
  coiffeurName,
  slots,
}: {
  locale: Locale;
  coiffeurName: string;
  slots: SlotView[];
}) {
  const t = translator(locale);
  const [remaining, setRemaining] = useState(slots);
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<
    { kind: "confirmed" | "queued" | "conflict" | "error"; text: string } | null
  >(null);

  async function handleBook(slot: SlotView) {
    setPendingSlotId(slot.id);
    setOutcome(null);
    const result = await bookSlot({
      slotId: slot.id,
      coiffeurName,
      serviceLabel: t(`service.${slot.serviceKey}`),
      start: slot.start,
    });

    if (result.status === "pending" || result.status === "confirmed") {
      setOutcome({ kind: "confirmed", text: `${t("booking.confirmedTitle")} — ${t("booking.confirmedBody")}` });
      setRemaining((current) => current.filter((s) => s.id !== slot.id));
    } else if (result.status === "queued") {
      setOutcome({ kind: "queued", text: `${t("booking.pendingSyncTitle")} — ${t("booking.pendingSyncBody")}` });
      setRemaining((current) => current.filter((s) => s.id !== slot.id));
    } else if (result.status === "conflict") {
      setOutcome({ kind: "conflict", text: `${t("booking.conflictTitle")} — ${t("booking.conflictBody")}` });
      setRemaining((current) => current.filter((s) => s.id !== slot.id));
    } else {
      setOutcome({ kind: "error", text: result.message });
    }
    setPendingSlotId(null);
  }

  return (
    <div>
      <div role="status" aria-live="assertive">
        {outcome && (
          <p className={outcome.kind === "confirmed" ? "notice-banner" : "error-banner"}>
            {outcome.text}
            {(outcome.kind === "confirmed" || outcome.kind === "queued") && (
              <>
                {" "}
                <Link href={`/${locale}/espace-client`}>{t("nav.myAccount")}</Link>
              </>
            )}
          </p>
        )}
      </div>

      {remaining.length === 0 ? (
        <p>{t("booking.noSlots")}</p>
      ) : (
        <ul className="slots-grid">
          {remaining.map((slot) => (
            <li key={slot.id}>
              <p>
                <strong>{t(`service.${slot.serviceKey}`)}</strong>
                <br />
                {new Date(slot.start).toLocaleString(locale)}
              </p>
              <button type="button" onClick={() => handleBook(slot)} disabled={pendingSlotId === slot.id}>
                {t("booking.confirm")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
