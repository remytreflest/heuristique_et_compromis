"use client";

import { useState } from "react";
import { translator, type Locale } from "@/lib/i18n";

interface Rule {
  keywords: string[];
  answer: string;
}

const ANSWERS: Record<Locale, { fallback: string; rules: Rule[] }> = {
  fr: {
    fallback:
      "Je ne suis pas sûr de comprendre. Vous pouvez utiliser le menu « Rechercher », « Mon espace » ou « Connexion » en haut de la page.",
    rules: [
      {
        keywords: ["annul"],
        answer: "Pour annuler un rendez-vous, ouvrez « Mon espace » puis cliquez sur « Annuler » sur le rendez-vous concerné.",
      },
      {
        keywords: ["report", "chang"],
        answer: "Pour reporter un rendez-vous, ouvrez « Mon espace », cliquez sur « Reporter » puis choisissez un nouveau créneau.",
      },
      {
        keywords: ["code", "authentif", "mfa", "connexion"],
        answer: "Le code à 6 chiffres provient de votre application d'authentification (ex. Google Authenticator), configurée lors de la création du compte.",
      },
      {
        keywords: ["rendez-vous", "réserv", "reserv"],
        answer: "Utilisez « Rechercher » pour trouver un coiffeur, puis « Voir les créneaux » sur sa fiche pour réserver.",
      },
      {
        keywords: ["hors-ligne", "connexion internet", "réseau"],
        answer: "Sans connexion, votre demande de réservation est mise en attente et envoyée automatiquement au retour du réseau.",
      },
    ],
  },
  en: {
    fallback: "I'm not sure I understand. You can use the \"Search\", \"My account\" or \"Log in\" menu at the top of the page.",
    rules: [
      { keywords: ["cancel"], answer: "To cancel an appointment, open \"My account\" then click \"Cancel\" on the relevant appointment." },
      { keywords: ["reschedule", "change"], answer: "To reschedule, open \"My account\", click \"Reschedule\" and pick a new slot." },
      { keywords: ["code", "auth", "mfa", "login"], answer: "The 6-digit code comes from your authenticator app, set up when you created your account." },
      { keywords: ["appointment", "book"], answer: "Use \"Search\" to find a hairdresser, then \"View slots\" on their page to book." },
      { keywords: ["offline", "network"], answer: "Without a connection, your booking request is queued and sent automatically once the network is back." },
    ],
  },
  ar: {
    fallback: "لست متأكدًا من فهم سؤالك. يمكنك استخدام قائمة «بحث» أو «حسابي» أو «تسجيل الدخول» أعلى الصفحة.",
    rules: [
      { keywords: ["لغ"], answer: "لإلغاء موعد، افتح «حسابي» ثم اضغط «إلغاء» بجانب الموعد المعني." },
      { keywords: ["أجل", "تأجيل"], answer: "لتأجيل موعد، افتح «حسابي»، اضغط «تأجيل» ثم اختر موعدًا جديدًا." },
      { keywords: ["رمز", "مصادقة"], answer: "الرمز المكوّن من 6 أرقام يأتي من تطبيق المصادقة الذي أعددته عند إنشاء الحساب." },
      { keywords: ["حجز", "موعد"], answer: "استخدم «بحث» للعثور على حلاق، ثم «عرض المواعيد المتاحة» في صفحته للحجز." },
      { keywords: ["اتصال", "شبكة"], answer: "بدون اتصال، يوضع طلب الحجز في الانتظار ويُرسل تلقائيًا عند عودة الشبكة." },
    ],
  },
};

function reply(locale: Locale, question: string): string {
  const { fallback, rules } = ANSWERS[locale];
  const lower = question.toLowerCase();
  for (const rule of rules) {
    if (rule.keywords.some((keyword) => lower.includes(keyword))) {
      return rule.answer;
    }
  }
  return fallback;
}

export function AssistantChat({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const [messages, setMessages] = useState<{ from: "bot" | "user"; text: string }[]>([
    { from: "bot", text: t("assistant.intro") },
  ]);
  const [input, setInput] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question) return;
    setMessages((current) => [
      ...current,
      { from: "user", text: question },
      { from: "bot", text: reply(locale, question) },
    ]);
    setInput("");
  }

  return (
    <section aria-labelledby="assistant-heading">
      <h1 id="assistant-heading">{t("assistant.title")}</h1>

      {/* role="log" : chaque nouveau message est annoncé par le lecteur d'écran sans déplacer le
          focus — aucun piège de focus (BF-12). */}
      <div
        role="log"
        aria-live="polite"
        aria-label={t("assistant.title")}
        style={{ maxHeight: "20rem", overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "0.4rem", padding: "1rem" }}
      >
        {messages.map((message, index) => (
          <p key={index}>
            <strong>{message.from === "bot" ? "🤖" : "🧑"}</strong> {message.text}
          </p>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <label htmlFor="assistant-input">
          {t("assistant.title")}
          <input
            id="assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("assistant.placeholder")}
          />
        </label>
        <button type="submit">{t("assistant.send")}</button>
      </form>
    </section>
  );
}
