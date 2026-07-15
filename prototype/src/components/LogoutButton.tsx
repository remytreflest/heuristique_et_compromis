"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

export function LogoutButton({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(`/${locale}`);
    router.refresh();
  }

  return (
    <button type="button" className="secondary" onClick={handleLogout}>
      {label}
    </button>
  );
}
