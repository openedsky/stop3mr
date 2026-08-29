import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(ROLES.PRODUCTION);
  if (error) return error;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const numeric = /^\d+$/.test(q) ? Number(q) : null;

  const [commerciaux, counts] = await Promise.all([
    prisma.utilisateur.findMany({
      where: {
        role: "COMMERCIAL",
        actif: true,
        ...(q
          ? {
              OR: [
                { identifiant: { contains: q } },
                { prenom: { contains: q } },
                { nom: { contains: q } },
                ...(numeric !== null ? [{ codeCommercial: numeric }] : []),
              ],
            }
          : {}),
      },
      select: {
        id: true,
        identifiant: true,
        prenom: true,
        nom: true,
        codeCommercial: true,
        telephone: true,
      },
      orderBy: [{ codeCommercial: "asc" }, { nom: "asc" }],
    }),
    prisma.plaque.groupBy({
      by: ["commercialId"],
      where: { statut: "AFFECTEE", commercialId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const stockMap = new Map(counts.map((c) => [c.commercialId, c._count._all]));

  return NextResponse.json({
    commerciaux: commerciaux.map((c) => ({
      id: c.id,
      identifiant: c.identifiant,
      prenom: c.prenom,
      nom: c.nom,
      codeCommercial: c.codeCommercial,
      telephone: c.telephone,
      stockAffecte: stockMap.get(c.id) ?? 0,
    })),
  });
}
