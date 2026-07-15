import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { AssistantChat } from "@/components/AssistantChat";

export default async function AssistantPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  return <AssistantChat locale={raw as Locale} />;
}
