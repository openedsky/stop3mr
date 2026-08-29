import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { getMetierSettings } from "@/lib/metier";
import { buildValiditeFigee, filtresExpirationFigee, serializeValidite } from "@/lib/validite";
import { paginationMeta, parseListParams } from "@/lib/pagination";
import { decryptClientRecord } from "@/lib/clients";

export async function GET(request: NextRequest) {
  const { error } = await requireAuth([...ROLES.ADMIN, ...ROLES.CT, ...ROLES.PRODUCTION]);
  if (error) return error;

  const settings = await getMetierSettings();
  const filtres = filtresExpirationFigee(settings.plaqueAlerteExpirationJours);
  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = parseListParams(searchParams, 30);
  const filtre = searchParams.get("statut") === "EXPIRE_BIENTOT" ? "EXPIRE_BIENTOT" : "EXPIREE";
  const where = filtre === "EXPIREE" ? filtres.expirees : filtres.expireBientot;

  const [expirees, expireBientot, ventes, total] = await Promise.all([
    prisma.vente.count({ where: filtres.expirees }),
    prisma.vente.count({ where: filtres.expireBientot }),
    prisma.vente.findMany({
      where,
      include: {
        plaque: {
          select: {
            numeroSerie: true,
            typeProduit: true,
            produit: { select: { libelle: true, code: true } },
          },
        },
        client: true,
        vehicule: { select: { immatriculation: true } },
      },
      orderBy: { dateExpiration: "asc" },
      skip,
      take: limit,
    }),
    prisma.vente.count({ where }),
  ]);

  return NextResponse.json({
    settings,
    compteurs: { expirees, expireBientot },
    plaques: ventes.map((v) => {
      const client = decryptClientRecord(v.client);
      const validite = buildValiditeFigee({
        dateAchat: v.dateVente,
        dateExpiration: v.dateExpiration,
        validiteMois: v.validiteMois,
        alerteJours: v.alerteExpirationJours ?? settings.plaqueAlerteExpirationJours,
      });
      return {
        id: v.id,
        numeroSerie: v.plaque.numeroSerie,
        produit: v.plaque.produit?.libelle ?? v.plaque.typeProduit,
        clientNom: client.nom,
        immatriculation: v.vehicule?.immatriculation ?? null,
        dateVente: v.dateVente,
        validite: serializeValidite(validite),
      };
    }),
    pagination: paginationMeta(page, limit, total),
  });
}
