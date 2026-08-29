import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

const siteSchema = z.object({
  code: z.string().min(2).max(10),
  libelle: z.string().min(2).max(150),
  pays: z.string().max(100).optional(),
  ville: z.string().max(100).optional().nullable(),
  commune: z.string().max(100).optional().nullable(),
  quartier: z.string().max(100).optional().nullable(),
  adresse: z.string().max(255).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

export async function GET() {
  const { error } = await requireAuth(["OPERATEUR", "ADMINISTRATEUR"]);
  if (error) return error;

  const sites = await prisma.siteProduction.findMany({
    orderBy: [{ actif: "desc" }, { libelle: "asc" }],
  });

  return NextResponse.json({ sites });
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth(["ADMINISTRATEUR"]);
  if (error) return error;

  const parsed = siteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const count = await prisma.siteProduction.count();
  if (count >= 1) {
    return NextResponse.json(
      { error: "Un seul site de production est autorisé dans le système." },
      { status: 400 }
    );
  }

  const code = parsed.data.code.toUpperCase();
  const site = await prisma.siteProduction.create({
    data: {
      code,
      libelle: parsed.data.libelle,
      pays: parsed.data.pays || "Côte d'Ivoire",
      ville: parsed.data.ville || null,
      commune: parsed.data.commune || null,
      quartier: parsed.data.quartier || null,
      adresse: parsed.data.adresse || null,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
    },
  });

  await logAudit({
    utilisateurId: Number(session!.user.id),
    action: "SITE_PRODUCTION_CREE",
    cible: code,
    adresseIp: getClientIp(request),
  });

  return NextResponse.json({ site }, { status: 201 });
}
