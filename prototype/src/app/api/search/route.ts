import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCachedSearch, setCachedSearch } from "@/lib/redis";

export interface SearchResult {
  id: string;
  name: string;
  salonName: string;
  city: string;
  languages: string[];
  services: string[];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const service = url.searchParams.get("service") ?? "";
  const city = url.searchParams.get("city") ?? "";
  const lang = url.searchParams.get("lang") ?? "";

  const cacheKey = `search:${service}:${city.toLowerCase()}:${lang}`;
  const cached = await getCachedSearch<SearchResult[]>(cacheKey);
  if (cached) {
    return NextResponse.json({ results: cached, cached: true });
  }

  const coiffeurs = await prisma.user.findMany({
    where: {
      role: "COIFFEUR",
      ...(service ? { services: { has: service } } : {}),
      ...(lang ? { languages: { has: lang } } : {}),
      ...(city
        ? {
            salon: {
              OR: [
                { city: { contains: city, mode: "insensitive" } },
                { name: { contains: city, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: { salon: true },
    orderBy: { name: "asc" },
  });

  const results: SearchResult[] = coiffeurs
    .filter((c) => c.salon)
    .map((c) => ({
      id: c.id,
      name: c.name,
      salonName: c.salon!.name,
      city: c.salon!.city,
      languages: c.languages,
      services: c.services,
    }));

  await setCachedSearch(cacheKey, results);

  return NextResponse.json({ results, cached: false });
}
