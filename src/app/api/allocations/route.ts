import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { ROLES } from "@/lib/roles";
import { sansTokensEnregistrement } from "@/lib/plaque-dto";

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth([...ROLES.PRODUCTION, "COMMERCIAL"]);
  if (error) return error;

  const commercialId = Number(new URL(request.url).searchParams.get("commercialId") ?? 0);
  const role = session!.user.role;
  const userId = Number(session!.user.id);

  const where =
    role === "COMMERCIAL"
      ? { commercialId: userId, statut: "AFFECTEE" as const }
      : commercialId
        ? { commercialId, statut: "AFFECTEE" as const }
        : { statut: "AFFECTEE" as const };

  const plaques = await prisma.plaque.findMany({
    where,
    omit: { tokenEnregistrement: true },
    include: {
      produit: { select: { code: true, libelle: true, prixHt: true } },
      commercial: { select: { id: true, identifiant: true, nom: true } },
    },
    orderBy: { affecteeLe: "desc" },
    take: 500,
  });

  return NextResponse.json({ plaques: sansTokensEnregistrement(plaques) });
}

const allocateSchema = z.object({
  commercialId: z.number().int().positive(),
  plaqueIds: z.array(z.number().int().positive()).optional(),
  produitId: z.number().int().positive().optional(),
  quantite: z.number().int().positive().optional(),
  siteProduction: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.PRODUCTION);
  if (error) return error;

  const parsed = allocateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const commercial = await prisma.utilisateur.findFirst({
    where: { id: parsed.data.commercialId, role: "COMMERCIAL", actif: true },
  });
  if (!commercial) {
    return NextResponse.json({ error: "Commercial introuvable ou inactif" }, { status: 404 });
  }

  const operateurId = Number(session!.user.id);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        let targets: { id: number; numeroSerie: string }[] = [];
        const site = parsed.data.siteProduction?.trim() || null;

        if (parsed.data.plaqueIds?.length) {
          const ids = [...new Set(parsed.data.plaqueIds)];
          const locked = await tx.$queryRaw<{ id: number; numero_serie: string }[]>(
            Prisma.sql`SELECT id, numero_serie FROM plaques WHERE id IN (${Prisma.join(ids)}) AND statut = 'EN_STOCK' FOR UPDATE`
          );
          if (locked.length !== ids.length) {
            throw new Error("Certaines plaques ne sont plus en stock production");
          }
          targets = locked.map((r) => ({ id: r.id, numeroSerie: r.numero_serie }));
        } else if (parsed.data.produitId && parsed.data.quantite) {
          const produitId = parsed.data.produitId;
          const quantite = parsed.data.quantite;

          const disponible = await tx.plaque.count({
            where: {
              produitId,
              statut: "EN_STOCK",
              ...(site ? { siteProduction: site } : {}),
            },
          });
          if (disponible < quantite) {
            throw new Error(`Stock insuffisant : ${disponible} plaque(s) réellement disponible(s)`);
          }

          const locked = site
            ? await tx.$queryRaw<{ id: number; numero_serie: string }[]>`
                SELECT id, numero_serie FROM plaques
                WHERE produit_id = ${produitId} AND statut = 'EN_STOCK' AND site_production = ${site}
                ORDER BY date_fabrication ASC
                LIMIT ${quantite}
                FOR UPDATE
              `
            : await tx.$queryRaw<{ id: number; numero_serie: string }[]>`
                SELECT id, numero_serie FROM plaques
                WHERE produit_id = ${produitId} AND statut = 'EN_STOCK'
                ORDER BY date_fabrication ASC
                LIMIT ${quantite}
                FOR UPDATE
              `;

          if (locked.length < quantite) {
            throw new Error(`Stock insuffisant : ${locked.length} plaque(s) réellement disponible(s)`);
          }
          targets = locked.map((r) => ({ id: r.id, numeroSerie: r.numero_serie }));
        } else {
          throw new Error("Indiquez des plaques ou un produit avec une quantité");
        }

        const now = new Date();
        const updated = await tx.plaque.updateMany({
          where: { id: { in: targets.map((t) => t.id) }, statut: "EN_STOCK" },
          data: {
            statut: "AFFECTEE",
            commercialId: commercial.id,
            affecteeLe: now,
          },
        });

        if (updated.count !== targets.length) {
          throw new Error("Le stock a changé pendant l'affectation. Relancez avec le stock réel.");
        }

        await tx.affectationStock.createMany({
          data: targets.map((t) => ({
            plaqueId: t.id,
            commercialId: commercial.id,
            operateurId,
          })),
        });

        return targets;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 }
    );

    await logAudit({
      utilisateurId: operateurId,
      action: "STOCK_AFFECTE",
      cible: commercial.identifiant,
      details: JSON.stringify({
        quantite: result.length,
        series: result.map((t) => t.numeroSerie),
      }),
      adresseIp: getClientIp(request),
    });

    return NextResponse.json(
      {
        affectees: result.length,
        commercial: { id: commercial.id, identifiant: commercial.identifiant, nom: commercial.nom },
        plaques: result,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur d'affectation";
    const status = message.includes("Stock insuffisant") || message.includes("plus en stock") || message.includes("changé")
      ? 409
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
