import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { rateLimitPersistent, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(ROLES.ADMIN);
  if (error) return error;

  const ip = getClientIp(request) ?? "local";
  const rl = await rateLimitPersistent(`geocode:${ip}`, 20, 60 * 1000);
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json({ error: "Adresse trop courte" }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("q", q);
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Stop3MR/2.0 (traçabilité plaques réfléchissantes)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Géocodage indisponible" }, { status: 502 });
  }

  const raw = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    address?: {
      country?: string;
      city?: string;
      town?: string;
      village?: string;
      suburb?: string;
      neighbourhood?: string;
      municipality?: string;
      county?: string;
      road?: string;
      house_number?: string;
    };
  }>;

  const results = raw.map((r) => {
    const a = r.address ?? {};
    const ville = a.city || a.town || a.village || a.municipality || null;
    const commune = a.municipality || a.county || ville;
    const quartier = a.suburb || a.neighbourhood || null;
    const adresse = [a.house_number, a.road].filter(Boolean).join(" ") || r.display_name;
    return {
      latitude: Number(r.lat),
      longitude: Number(r.lon),
      label: r.display_name,
      pays: a.country ?? "Côte d'Ivoire",
      ville,
      commune,
      quartier,
      adresse,
    };
  });

  return NextResponse.json({ results });
}
