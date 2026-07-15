"use client";

const STORAGE_KEY = "salon-rdv:pending-appointments";

export interface PendingAppointment {
  idempotencyKey: string;
  slotId: string;
  coiffeurName: string;
  serviceLabel: string;
  start: string;
  createdAt: string;
}

function readQueue(): PendingAppointment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingAppointment[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingAppointment[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function getQueue(): PendingAppointment[] {
  return readQueue();
}

export function addToQueue(item: PendingAppointment): void {
  const queue = readQueue();
  queue.push(item);
  writeQueue(queue);
}

export function removeFromQueue(idempotencyKey: string): void {
  writeQueue(readQueue().filter((item) => item.idempotencyKey !== idempotencyKey));
}

export type BookResult =
  | { status: "confirmed" }
  | { status: "pending" }
  | { status: "queued" }
  | { status: "conflict"; message: string }
  | { status: "error"; message: string };

/**
 * Tente la réservation en ligne ; en cas d'échec réseau, met la demande en file locale plutôt que
 * de la faire échouer — c'est le cœur du compromis « mesuré » de l'ADR-004 : l'IHM affiche
 * explicitement l'état « en attente de synchronisation », jamais un état confirmé non garanti.
 */
export async function bookSlot(
  params: { slotId: string; coiffeurName: string; serviceLabel: string; start: string }
): Promise<BookResult> {
  const idempotencyKey =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  try {
    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId: params.slotId, idempotencyKey }),
    });

    if (response.status === 409) {
      const body = await response.json().catch(() => ({}));
      return { status: "conflict", message: body.message ?? "Créneau déjà pris." };
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { status: "error", message: body.message ?? "Erreur lors de la réservation." };
    }

    return { status: "pending" };
  } catch {
    addToQueue({
      idempotencyKey,
      slotId: params.slotId,
      coiffeurName: params.coiffeurName,
      serviceLabel: params.serviceLabel,
      start: params.start,
      createdAt: new Date().toISOString(),
    });
    return { status: "queued" };
  }
}

export interface SyncOutcome {
  confirmed: string[];
  conflicts: string[];
  stillPending: number;
}

/** Rejoue la file locale : appelé au clic sur « Synchroniser maintenant » ou à l'événement `online`. */
export async function syncQueue(): Promise<SyncOutcome> {
  const queue = readQueue();
  const confirmed: string[] = [];
  const conflicts: string[] = [];

  for (const item of queue) {
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: item.slotId, idempotencyKey: item.idempotencyKey }),
      });

      if (response.ok) {
        confirmed.push(item.idempotencyKey);
        removeFromQueue(item.idempotencyKey);
      } else if (response.status === 409) {
        conflicts.push(item.idempotencyKey);
        removeFromQueue(item.idempotencyKey);
      }
      // Autre erreur ou réseau indisponible : reste en file, retenté à la prochaine synchronisation.
    } catch {
      break;
    }
  }

  return { confirmed, conflicts, stillPending: readQueue().length };
}
