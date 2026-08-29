import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { buildQrA4Pdf } from "@/lib/qr-pdf";

function firstSerie(request: NextRequest, bodySeries?: string[]): string | null {
  const fromQuery =
    new URL(request.url).searchParams.get("serie")?.trim() ||
    new URL(request.url).searchParams.get("series")?.split(",")[0]?.trim() ||
    "";
  const fromBody = bodySeries?.[0]?.trim() ?? "";
  return fromQuery || fromBody || null;
}

async function pdfForSerie(numeroSerie: string) {
  const plaque = await prisma.plaque.findUnique({
    where: { numeroSerie },
    select: { numeroSerie: true, qrCodeData: true },
  });
  if (!plaque) return null;
  const pdf = await buildQrA4Pdf(plaque);
  return { pdf, filename: `qr-${plaque.numeroSerie}.pdf` };
}

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(ROLES.PRODUCTION);
  if (error) return error;

  const seriesParam = new URL(request.url).searchParams.get("series")?.trim() ?? "";
  const many = seriesParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (many.length > 1) {
    return NextResponse.json(
      { error: "Un PDF QR code ne peut contenir qu'une seule plaque. Téléchargez un fichier par numéro de série." },
      { status: 400 }
    );
  }

  const serie = firstSerie(request);
  if (!serie) {
    return NextResponse.json({ error: "Numéro de série requis" }, { status: 400 });
  }

  const result = await pdfForSerie(serie);
  if (!result) {
    return NextResponse.json({ error: "Plaque introuvable" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth(ROLES.PRODUCTION);
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const series = Array.isArray(body.series)
    ? (body.series as unknown[]).map((s) => String(s).trim()).filter(Boolean)
    : [];

  if (series.length > 1) {
    return NextResponse.json(
      { error: "Un PDF QR code ne peut contenir qu'une seule plaque." },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  url.searchParams.set("serie", series[0] ?? body.serie ?? "");
  return GET(new NextRequest(url, { headers: request.headers }));
}
