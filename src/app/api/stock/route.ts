import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";

export async function GET() {
  const { error, session } = await requireAuth([...ROLES.PRODUCTION, "COMMERCIAL"]);
  if (error) return error;

  const role = session!.user.role;
  const userId = Number(session!.user.id);

  if (role === "COMMERCIAL") {
    const [affectees, vendues, parProduit] = await Promise.all([
      prisma.plaque.count({ where: { commercialId: userId, statut: "AFFECTEE" } }),
      prisma.vente.count({ where: { vendeurId: userId, canal: "COMMERCIAL" } }),
      prisma.plaque.groupBy({
        by: ["produitId", "statut"],
        where: { commercialId: userId, statut: "AFFECTEE" },
        _count: true,
      }),
    ]);

    const produits = await prisma.produit.findMany({
      where: { id: { in: parProduit.map((p) => p.produitId).filter((id): id is number => id !== null) } },
    });
    const produitMap = new Map(produits.map((p) => [p.id, p]));

    return NextResponse.json({
      resume: { total: affectees + vendues, enStock: 0, affectees, vendues },
      stockVendeur: parProduit
        .filter((s) => s.statut === "AFFECTEE")
        .map((s) => ({
          produit: s.produitId ? produitMap.get(s.produitId)?.libelle ?? "Produit" : "Ancien modèle",
          code: s.produitId ? produitMap.get(s.produitId)?.code ?? "" : "",
          quantite: s._count,
        })),
      stock: [],
      alertes: [],
      seuilAlerte: 0,
    });
  }

  const [parType, parSite, parProduitStatut, total, enStock, affectees, vendues] = await Promise.all([
    prisma.plaque.groupBy({
      by: ["typeProduit", "statut"],
      _count: true,
    }),
    prisma.plaque.groupBy({
      by: ["siteProduction", "typeProduit", "statut"],
      _count: true,
    }),
    prisma.plaque.groupBy({
      by: ["produitId", "siteProduction", "statut"],
      _count: true,
    }),
    prisma.plaque.count(),
    prisma.plaque.count({ where: { statut: "EN_STOCK" } }),
    prisma.plaque.count({ where: { statut: "AFFECTEE" } }),
    prisma.plaque.count({ where: { statut: "VENDUE" } }),
  ]);

  const produits = await prisma.produit.findMany();
  const produitMap = new Map(produits.map((p) => [p.id, p]));

  const stock = parProduitStatut
    .filter((s) => s.statut === "EN_STOCK")
    .map((s) => ({
      site: s.siteProduction,
      type: s.produitId ? produitMap.get(s.produitId)?.libelle ?? "Ancien modèle" : "Ancien modèle",
      produitId: s.produitId,
      quantite: s._count,
    }));

  const stockAffecte = parProduitStatut
    .filter((s) => s.statut === "AFFECTEE")
    .map((s) => ({
      site: s.siteProduction,
      type: s.produitId ? produitMap.get(s.produitId)?.libelle ?? "Ancien modèle" : "Ancien modèle",
      quantite: s._count,
    }));

  const seuilParam = await prisma.parametre.findUnique({ where: { cle: "stock_seuil_alerte" } });
  const seuilAlerte = seuilParam ? Number(seuilParam.valeur) : 10;
  const alertes = stock.filter((s) => s.quantite <= seuilAlerte);

  return NextResponse.json({
    resume: { total, enStock, affectees, vendues },
    parType,
    parSite,
    stock,
    stockAffecte,
    alertes,
    seuilAlerte,
  });
}
