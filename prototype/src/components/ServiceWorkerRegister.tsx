"use client";

import { useEffect } from "react";

/**
 * Enregistre le Service Worker qui met en cache les pages/recherches déjà consultées (ADR-004,
 * fidélité « mesurée » : cache de lecture réel, pas d'API Background Sync).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch((error) => {
        console.error("Échec d'enregistrement du service worker", error);
      });
    }
  }, []);

  return null;
}
