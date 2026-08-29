import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { decryptClientRecord } from "@/lib/clients";
import { getMetierSettings } from "@/lib/metier";
import { filtresExpirationFigee } from "@/lib/validite";

export async function GET() {
  const { error } = await requireAuth(["ADMINISTRATEUR"]);
  if (error) return error;

  const settings = await getMetierSettings();
  const filtres = filtresExpirationFigee(settings.plaqueAlerteExpirationJours);

  const [totalPlaques, enStock, vendues, ventesRecentes, auditRecent, expirees, expireBientot, commissionsVentesDue, commissionsControlesDue, ventesDirectes] =
    await Promise.all([
      prisma.plaque.count(),
      prisma.plaque.count({ where: { statut: "EN_STOCK" } }),
      prisma.plaque.count({ where: { statut: "VENDUE" } }),
      prisma.vente.findMany({
        take: 10,
        orderBy: { dateVente: "desc" },
        include: {
          plaque: { select: { numeroSerie: true, typeProduit: true } },
          client: true,
          vehicule: { select: { immatriculation: true } },
        },
      }),
      prisma.journalAudit.findMany({
        take: 15,
        orderBy: { horodatage: "desc" },
        include: {
          utilisateur: { select: { identifiant: true, nom: true } },
        },
      }),
      prisma.vente.count({ where: filtres.expirees }),
      prisma.vente.count({ where: filtres.expireBientot }),
      prisma.vente.aggregate({
        where: { canal: "COMMERCIAL", paiementCommissionId: null, commissionMontant: { gt: 0 } },
        _sum: { commissionMontant: true },
      }),
      prisma.verification.aggregate({
        where: { paiementCommissionId: null, resultat: "AUTHENTIQUE", commissionMontant: { gt: 0 } },
        _sum: { commissionMontant: true },
      }),
      prisma.vente.count({ where: { canal: "DIRECTE" } }),
    ]);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const ventesParJour = await prisma.$queryRaw<Array<{ jour: string; n: bigint }>>`
    SELECT DATE(date_vente) AS jour, COUNT(*) AS n
    FROM ventes
    WHERE date_vente >= ${thirtyDaysAgo}
    GROUP BY DATE(date_vente)
    ORDER BY jour
  `;

  return NextResponse.json({
    stats: {
      totalPlaques,
      enStock,
      vendues,
      tauxVente: totalPlaques > 0 ? Math.round((vendues / totalPlaques) * 100) : 0,
      plaquesExpirees: expirees,
      plaquesExpireBientot: expireBientot,
      commissionsVentesDue: commissionsVentesDue._sum.commissionMontant ?? 0,
      commissionsControlesDue: commissionsControlesDue._sum.commissionMontant ?? 0,
      ventesDirectes,
    },
    ventesRecentes: ventesRecentes.map((v) => ({
      ...v,
      client: decryptClientRecord(v.client),
      vehiculeImmat: v.vehicule?.immatriculation ?? "—",
    })),
    auditRecent,
    ventesParJour: ventesParJour.map((r) => ({ jour: r.jour, n: Number(r.n) })),
  });
}
