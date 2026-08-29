import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { nomComplet } from "@/lib/territoire";

function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 1);
  return { from, to };
}

function parseRange(search: URLSearchParams) {
  const mois = search.get("mois");
  const fromStr = search.get("from");
  const toStr = search.get("to");
  if (fromStr && toStr) {
    const from = new Date(fromStr);
    const to = new Date(toStr);
    to.setHours(23, 59, 59, 999);
    return { from, to, label: `${fromStr} → ${toStr}` };
  }
  if (mois && /^\d{4}-\d{2}$/.test(mois)) {
    const { from, to } = monthBounds(mois);
    return { from, to: new Date(to.getTime() - 1), label: mois };
  }
  const now = new Date();
  const { from, to } = monthBounds(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  return { from, to: new Date(to.getTime() - 1), label: "mois en cours" };
}

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.PERFORMANCES);
  if (error) return error;

  const { from, to, label } = parseRange(new URL(request.url).searchParams);
  const role = session!.user.role;
  const userId = Number(session!.user.id);
  const isAdmin = role === "ADMINISTRATEUR";

  const venteWhere = {
    dateVente: { gte: from, lte: to },
    ...(!isAdmin ? { vendeurId: userId } : {}),
  };
  const venteCommercialeWhere = { ...venteWhere, canal: "COMMERCIAL" as const };
  const venteDirecteWhere = { ...venteWhere, canal: "DIRECTE" as const };
  const verifWhere = {
    horodatage: { gte: from, lte: to },
    ...(!isAdmin ? { agentId: userId } : {}),
  };
  const venteExtra = isAdmin ? Prisma.empty : Prisma.sql`AND vendeur_id = ${userId}`;
  const verifExtra = isAdmin ? Prisma.empty : Prisma.sql`AND agent_id = ${userId}`;

  const [totauxVentes, totauxDirectes, totauxVerifs, parVendeur, parAgent, parCentre, evolutionVentes, evolutionVerifs, verifsParCentre] =
    await Promise.all([
      prisma.vente.aggregate({
        where: venteWhere,
        _count: { _all: true },
        _sum: { prixVente: true, commissionMontant: true },
      }),
      prisma.vente.aggregate({
        where: venteDirecteWhere,
        _count: { _all: true },
        _sum: { prixVente: true },
      }),
      prisma.verification.groupBy({
        by: ["resultat"],
        where: verifWhere,
        _count: { _all: true },
        _sum: { commissionMontant: true },
      }),
      role === "AGENT_CT"
        ? Promise.resolve([])
        : prisma.vente.groupBy({
            by: ["vendeurId"],
            where: venteCommercialeWhere,
            _count: { _all: true },
            _sum: { prixVente: true, commissionMontant: true },
          }),
      role === "COMMERCIAL"
        ? Promise.resolve([])
        : prisma.verification.groupBy({
            by: ["agentId"],
            where: verifWhere,
            _count: { _all: true },
            _sum: { commissionMontant: true },
          }),
      prisma.vente.groupBy({
        by: ["centreId"],
        where: { ...venteWhere, centreId: { not: null } },
        _count: { _all: true },
        _sum: { prixVente: true },
      }),
      prisma.$queryRaw<Array<{ periode: string; n: bigint; ca: bigint | null }>>`
        SELECT DATE_FORMAT(date_vente, '%Y-%m') AS periode,
               COUNT(*) AS n,
               COALESCE(SUM(prix_vente), 0) AS ca
        FROM ventes
        WHERE date_vente >= ${from} AND date_vente <= ${to} ${venteExtra}
        GROUP BY DATE_FORMAT(date_vente, '%Y-%m')
        ORDER BY periode
      `,
      prisma.$queryRaw<Array<{ periode: string; n: bigint }>>`
        SELECT DATE_FORMAT(horodatage, '%Y-%m') AS periode, COUNT(*) AS n
        FROM verifications
        WHERE horodatage >= ${from} AND horodatage <= ${to} ${verifExtra}
        GROUP BY DATE_FORMAT(horodatage, '%Y-%m')
        ORDER BY periode
      `,
      prisma.verification.groupBy({
        by: ["centreId"],
        where: { ...verifWhere, centreId: { not: null } },
        _count: { _all: true },
      }),
    ]);

  const vendeurIds = parVendeur.map((r) => r.vendeurId).filter((id): id is number => id != null);
  const agentIds = parAgent.map((r) => r.agentId);
  const centreIds = [
    ...new Set(
      [
        ...parCentre.map((r) => r.centreId),
        ...verifsParCentre.map((r) => r.centreId),
      ].filter((id): id is number => id != null)
    ),
  ];

  const [vendeurs, agents, centres] = await Promise.all([
    vendeurIds.length
      ? prisma.utilisateur.findMany({
          where: { id: { in: vendeurIds } },
          select: { id: true, identifiant: true, prenom: true, nom: true },
        })
      : [],
    agentIds.length
      ? prisma.utilisateur.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, identifiant: true, prenom: true, nom: true },
        })
      : [],
    centreIds.length
      ? prisma.centreControle.findMany({
          where: { id: { in: centreIds } },
          select: { id: true, code: true, libelle: true, ville: true },
        })
      : [],
  ]);

  const vMap = new Map(vendeurs.map((u) => [u.id, u]));
  const aMap = new Map(agents.map((u) => [u.id, u]));
  const cMap = new Map(centres.map((c) => [c.id, c]));
  const venteCentreMap = new Map(parCentre.map((r) => [r.centreId, r]));
  const verifCentreMap = new Map(verifsParCentre.map((r) => [r.centreId, r._count._all]));

  const authentiques = totauxVerifs.find((r) => r.resultat === "AUTHENTIQUE")?._count._all ?? 0;
  const inconnues = totauxVerifs.find((r) => r.resultat === "INCONNUE")?._count._all ?? 0;
  const contrefaites = totauxVerifs.find((r) => r.resultat === "CONTREFAITE")?._count._all ?? 0;
  const verifications = authentiques + inconnues + contrefaites;
  const commissionControle = totauxVerifs.reduce((sum, r) => sum + (r._sum.commissionMontant ?? 0), 0);

  const periodes = [...new Set([...evolutionVentes.map((r) => r.periode), ...evolutionVerifs.map((r) => r.periode)])].sort();

  return NextResponse.json({
    scope: isAdmin ? "global" : "utilisateur",
    periode: { from: from.toISOString(), to: to.toISOString(), label },
    totaux: {
      ventes: totauxVentes._count._all,
      chiffreAffaires: totauxVentes._sum.prixVente ?? 0,
      commission: totauxVentes._sum.commissionMontant ?? 0,
      ventesDirectes: totauxDirectes._count._all,
      chiffreAffairesDirect: totauxDirectes._sum.prixVente ?? 0,
      commissionControle,
      verifications,
      authentiques,
      inconnues,
      contrefaites,
    },
    evolution: periodes.map((periode) => {
      const vente = evolutionVentes.find((r) => r.periode === periode);
      const verif = evolutionVerifs.find((r) => r.periode === periode);
      return {
        periode,
        ventes: Number(vente?.n ?? 0),
        ca: Number(vente?.ca ?? 0),
        controles: Number(verif?.n ?? 0),
      };
    }),
    vendeurs: parVendeur
      .filter((r) => r.vendeurId)
      .map((r) => ({
        id: r.vendeurId,
        nom: nomComplet(vMap.get(r.vendeurId!) ?? { identifiant: `#${r.vendeurId}` }),
        identifiant: vMap.get(r.vendeurId!)?.identifiant ?? "",
        ventes: r._count._all,
        chiffreAffaires: r._sum.prixVente ?? 0,
        commission: r._sum.commissionMontant ?? 0,
      }))
      .sort((a, b) => b.chiffreAffaires - a.chiffreAffaires)
      .slice(0, 30),
    agents: parAgent
      .map((r) => ({
        id: r.agentId,
        nom: nomComplet(aMap.get(r.agentId) ?? { identifiant: `#${r.agentId}` }),
        identifiant: aMap.get(r.agentId)?.identifiant ?? "",
        verifications: r._count._all,
        commission: r._sum.commissionMontant ?? 0,
      }))
      .sort((a, b) => b.verifications - a.verifications)
      .slice(0, 30),
    centres: centreIds
      .map((id) => {
        const vente = venteCentreMap.get(id);
        return {
          id,
          libelle: cMap.get(id)?.libelle ?? `Centre ${id}`,
          ville: cMap.get(id)?.ville ?? "",
          ventes: vente?._count._all ?? 0,
          chiffreAffaires: vente?._sum.prixVente ?? 0,
          verifications: verifCentreMap.get(id) ?? 0,
        };
      })
      .sort((a, b) => b.ventes + b.verifications - (a.ventes + a.verifications))
      .slice(0, 30),
  });
}
