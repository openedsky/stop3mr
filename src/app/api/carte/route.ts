import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { CentreCarte, formatAdresseCentre } from "@/lib/geo";

function emptyStats() {
  return {
    stockDisponible: 0,
    ventes: 0,
    verifications: 0,
    authentiques: 0,
    inconnues: 0,
    contrefaites: 0,
    agents: 0,
    commerciaux: 0,
    parProduit: [] as CentreCarte["stats"]["parProduit"],
  };
}

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(ROLES.CARTE);
  if (error) return error;

  const detailId = Number(new URL(request.url).searchParams.get("centreId") ?? 0);

  const [centres, usines, users, ventes, verifs, stockRows, stockUsine] = await Promise.all([
    prisma.centreControle.findMany({
      where: { actif: true },
      select: {
        id: true,
        code: true,
        libelle: true,
        pays: true,
        ville: true,
        commune: true,
        quartier: true,
        adresse: true,
        latitude: true,
        longitude: true,
      },
    }),
    prisma.siteProduction.findMany({
      where: { actif: true },
      select: {
        id: true,
        code: true,
        libelle: true,
        pays: true,
        ville: true,
        commune: true,
        quartier: true,
        adresse: true,
        latitude: true,
        longitude: true,
      },
    }),
    prisma.utilisateur.findMany({
      where: { actif: true, centreControleId: { not: null }, role: { in: ["COMMERCIAL", "AGENT_CT"] } },
      select: { id: true, role: true, centreControleId: true },
    }),
    prisma.vente.groupBy({ by: ["centreId"], _count: { _all: true } }),
    prisma.verification.groupBy({ by: ["centreId", "resultat"], _count: { _all: true } }),
    prisma.plaque.groupBy({
      by: ["commercialId"],
      where: { statut: "AFFECTEE", commercialId: { not: null } },
      _count: { _all: true },
    }),
    prisma.plaque.groupBy({
      by: ["siteProduction"],
      where: { statut: "EN_STOCK" },
      _count: { _all: true },
    }),
  ]);

  const usersByCentre = new Map<number, { agents: number; commerciaux: number; commercialIds: number[] }>();
  for (const u of users) {
    const id = u.centreControleId!;
    if (!usersByCentre.has(id)) usersByCentre.set(id, { agents: 0, commerciaux: 0, commercialIds: [] });
    const row = usersByCentre.get(id)!;
    if (u.role === "AGENT_CT") row.agents += 1;
    if (u.role === "COMMERCIAL") {
      row.commerciaux += 1;
      row.commercialIds.push(u.id);
    }
  }

  const stockByCommercial = new Map<number, number>();
  for (const p of stockRows) {
    if (!p.commercialId) continue;
    stockByCommercial.set(p.commercialId, p._count._all);
  }

  const ventesByCentre = new Map(ventes.filter((v) => v.centreId != null).map((v) => [v.centreId!, v._count._all]));
  const verifByCentre = new Map<number, { total: number; authentiques: number; inconnues: number; contrefaites: number }>();
  for (const v of verifs) {
    if (v.centreId == null) continue;
    if (!verifByCentre.has(v.centreId)) {
      verifByCentre.set(v.centreId, { total: 0, authentiques: 0, inconnues: 0, contrefaites: 0 });
    }
    const row = verifByCentre.get(v.centreId)!;
    row.total += v._count._all;
    if (v.resultat === "AUTHENTIQUE") row.authentiques += v._count._all;
    if (v.resultat === "INCONNUE") row.inconnues += v._count._all;
    if (v.resultat === "CONTREFAITE") row.contrefaites += v._count._all;
  }

  const ctPayload: CentreCarte[] = centres.map((c) => {
    const people = usersByCentre.get(c.id) ?? { agents: 0, commerciaux: 0, commercialIds: [] };
    const stock = people.commercialIds.reduce((s, id) => s + (stockByCommercial.get(id) ?? 0), 0);
    const v = verifByCentre.get(c.id);
    return {
      id: c.id,
      kind: "controle",
      code: c.code,
      libelle: c.libelle,
      pays: c.pays,
      ville: c.ville,
      commune: c.commune,
      quartier: c.quartier,
      adresse: c.adresse,
      latitude: c.latitude,
      longitude: c.longitude,
      georeference: c.latitude != null && c.longitude != null,
      adresseComplete: formatAdresseCentre(c),
      couvertVendeur: people.commerciaux > 0,
      stats: {
        ...emptyStats(),
        stockDisponible: stock,
        ventes: ventesByCentre.get(c.id) ?? 0,
        verifications: v?.total ?? 0,
        authentiques: v?.authentiques ?? 0,
        inconnues: v?.inconnues ?? 0,
        contrefaites: v?.contrefaites ?? 0,
        agents: people.agents,
        commerciaux: people.commerciaux,
      },
    };
  });

  if (detailId) {
    const target = ctPayload.find((c) => c.id === detailId);
    if (target) {
      const commerciaux = users.filter((u) => u.centreControleId === detailId && u.role === "COMMERCIAL").map((u) => u.id);
      const ids = commerciaux.length ? commerciaux : [0];
      type AggRow = { produit_id: number | null; code: string; libelle: string; n: bigint | number };
      const [stockDetail, ventesDetail] = await Promise.all([
        prisma.$queryRaw<AggRow[]>`
          SELECT p.produit_id, COALESCE(pr.code, 'ANCIEN') AS code, COALESCE(pr.libelle, 'Ancien modèle') AS libelle, COUNT(*) AS n
          FROM plaques p
          LEFT JOIN produits pr ON pr.id = p.produit_id
          WHERE p.statut = 'AFFECTEE' AND p.commercial_id IN (${Prisma.join(ids)})
          GROUP BY p.produit_id, pr.code, pr.libelle
        `,
        prisma.$queryRaw<AggRow[]>`
          SELECT p.produit_id, COALESCE(pr.code, 'ANCIEN') AS code, COALESCE(pr.libelle, 'Ancien modèle') AS libelle, COUNT(*) AS n
          FROM ventes v
          INNER JOIN plaques p ON p.id = v.plaque_id
          LEFT JOIN produits pr ON pr.id = p.produit_id
          WHERE v.centre_id = ${detailId}
          GROUP BY p.produit_id, pr.code, pr.libelle
        `,
      ]);
      const parProduit = new Map<string, CentreCarte["stats"]["parProduit"][number]>();
      const bump = (row: AggRow, field: "stock" | "vendus") => {
        if (!parProduit.has(row.code)) {
          parProduit.set(row.code, {
            produitId: row.produit_id,
            code: row.code,
            libelle: row.libelle,
            stock: 0,
            vendus: 0,
          });
        }
        parProduit.get(row.code)![field] += Number(row.n);
      };
      for (const p of stockDetail) bump(p, "stock");
      for (const v of ventesDetail) bump(v, "vendus");
      target.stats.parProduit = [...parProduit.values()];
    }
  }

  const stockUsineByCode = new Map(stockUsine.map((s) => [s.siteProduction, s._count._all]));
  const productionPayload: CentreCarte[] = usines.map((s) => ({
    id: s.id,
    kind: "production",
    code: s.code,
    libelle: s.libelle,
    pays: s.pays,
    ville: s.ville,
    commune: s.commune,
    quartier: s.quartier,
    adresse: s.adresse,
    latitude: s.latitude,
    longitude: s.longitude,
    georeference: s.latitude != null && s.longitude != null,
    adresseComplete: formatAdresseCentre(s),
    couvertVendeur: false,
    stats: {
      ...emptyStats(),
      stockDisponible: stockUsineByCode.get(s.code) ?? 0,
    },
  }));

  const sites = [...productionPayload, ...ctPayload];
  const totaux = {
    usines: productionPayload.length,
    centres: ctPayload.length,
    georeferences: sites.filter((c) => c.georeference).length,
    couverts: ctPayload.filter((c) => c.couvertVendeur).length,
    stock: ctPayload.reduce((s, c) => s + c.stats.stockDisponible, 0),
    stockUsine: productionPayload.reduce((s, c) => s + c.stats.stockDisponible, 0),
    ventes: ctPayload.reduce((s, c) => s + c.stats.ventes, 0),
    verifications: ctPayload.reduce((s, c) => s + c.stats.verifications, 0),
  };

  return NextResponse.json({ sites, totaux });
}
