import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { APP_ROLES, ROLES } from "@/lib/roles";
import { parseListParams, paginationMeta } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(APP_ROLES);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const { page, limit, skip, q } = parseListParams(searchParams, 40);
  const actifParam = searchParams.get("actif")?.trim();

  const where = {
    ...(actifParam === "all" ? {} : { actif: actifParam !== "false" }),
    ...(q
      ? {
          OR: [
            { code: { contains: q } },
            { libelle: { contains: q } },
            { ville: { contains: q } },
            { commune: { contains: q } },
            { quartier: { contains: q } },
          ],
        }
      : {}),
  };

  const [centres, total] = await Promise.all([
    prisma.centreControle.findMany({
      where,
      orderBy: [{ ville: "asc" }, { libelle: "asc" }],
      skip,
      take: limit,
      include: {
        _count: { select: { agents: true, verifications: true, ventes: true } },
      },
    }),
    prisma.centreControle.count({ where }),
  ]);

  return NextResponse.json({ centres, total, page, limit, pagination: paginationMeta(page, limit, total) });
}

const centreFields = {
  code: z.string().min(2).max(20).transform((v) => v.toUpperCase()),
  libelle: z.string().min(3).max(200),
  pays: z.string().max(100).optional(),
  ville: z.string().max(100).optional().nullable(),
  commune: z.string().max(100).optional().nullable(),
  quartier: z.string().max(100).optional().nullable(),
  adresse: z.string().max(255).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
};

const createSchema = z.object(centreFields);

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.ADMIN);
  if (error) return error;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const exists = await prisma.centreControle.findUnique({ where: { code: parsed.data.code } });
  if (exists) {
    return NextResponse.json({ error: "Code déjà utilisé" }, { status: 409 });
  }

  const centre = await prisma.centreControle.create({
    data: {
      code: parsed.data.code,
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
    action: "CENTRE_CT_CREE",
    cible: centre.code,
    details: JSON.stringify({
      libelle: centre.libelle,
      ville: centre.ville,
      latitude: centre.latitude,
      longitude: centre.longitude,
    }),
    adresseIp: getClientIp(request),
  });

  return NextResponse.json({ centre }, { status: 201 });
}
