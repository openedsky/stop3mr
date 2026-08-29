/**
 * Volume de test : ~5576 plaques vendues, plus stock usine et stock vendeurs,
 * réparti sur les familles du catalogue.
 * Usage : npm run db:seed:volume
 */
import { randomBytes } from "crypto";
import { PrismaClient, StatutPlaque, TypeProduit } from "@prisma/client";
import { encryptClientData } from "../src/lib/clients";
import { computeCommission } from "../src/lib/money";
import { figerValiditeVente } from "../src/lib/validite";

const prisma = new PrismaClient();

const PREFIX = "R3M-YP-260820-";
const DATE_PREFIX = "260820";
const TARGET_VENDUES = 5576;
const TARGET_AFFECTEES = 2490;
const TARGET_STOCK = 1100;
const VITESSES = [50, 60, 70, 75, 80, 85, 90];

/** Pondération par code catalogue (familles LIMITATION / rouge / blanc / chevrons). */
const POIDS: Record<string, number> = {
  "LIM-GRIS-BARRE": 12,
  "LIM-GRIS": 10,
  "LIM-JAUNE-BARRE": 8,
  "ROUGE-1240": 15,
  "ROUGE-1220": 10,
  "BLANC-1240": 10,
  "BAND-RJ-1353": 12,
  "BAND-RJ-6526": 8,
  "BAND-RB-1353": 8,
  "BAND-RB-6526": 7,
};

const QR =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="#e2e8f0" width="80" height="80"/></svg>'
  );

function split(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => Math.floor((total * w) / sum));
  let gap = total - raw.reduce((a, b) => a + b, 0);
  let i = 0;
  while (gap > 0) {
    raw[i % raw.length] += 1;
    gap -= 1;
    i += 1;
  }
  return raw;
}

async function chunked<T>(items: T[], size: number, fn: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size));
  }
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  const existingVendues = await prisma.plaque.count({
    where: { numeroSerie: { startsWith: PREFIX }, statut: "VENDUE" },
  });
  if (existingVendues >= TARGET_VENDUES) {
    console.log(`Volume déjà présent (${existingVendues} vendues).`);
    return;
  }

  if (existingVendues > 0) {
    const ids = (
      await prisma.plaque.findMany({
        where: { numeroSerie: { startsWith: PREFIX } },
        select: { id: true },
      })
    ).map((p) => p.id);
    const ventesExistantes = await prisma.vente.findMany({
      where: { plaqueId: { in: ids } },
      select: { id: true },
    });
    if (ventesExistantes.length) {
      await prisma.recuPaiement.deleteMany({
        where: { facture: { venteId: { in: ventesExistantes.map((v) => v.id) } } },
      });
      await prisma.facture.deleteMany({ where: { venteId: { in: ventesExistantes.map((v) => v.id) } } });
    }
    await prisma.vente.deleteMany({ where: { plaqueId: { in: ids } } });
    await prisma.verification.deleteMany({ where: { plaqueId: { in: ids } } });
    await prisma.affectationStock.deleteMany({ where: { plaqueId: { in: ids } } });
    await prisma.plaque.deleteMany({ where: { numeroSerie: { startsWith: PREFIX } } });
  }

  const [produits, vendeurs, operateur] = await Promise.all([
    prisma.produit.findMany({ where: { actif: true }, orderBy: { ordre: "asc" } }),
    prisma.utilisateur.findMany({
      where: { role: "COMMERCIAL", actif: true, identifiant: { startsWith: "vendeur." } },
      orderBy: { identifiant: "asc" },
      select: { id: true, centreControleId: true },
    }),
    prisma.utilisateur.findUnique({ where: { identifiant: "operateur" } }),
  ]);

  if (!produits.length || !vendeurs.length || !operateur) {
    throw new Error("Catalogue, vendeurs ou opérateur manquants. Lancez d'abord db:seed:territoire.");
  }
  const opId = operateur.id;

  const poids = produits.map((p) => POIDS[p.code] ?? 5);
  const nVendues = split(TARGET_VENDUES, poids);
  const nAffectees = split(TARGET_AFFECTEES, poids);
  const nStock = split(TARGET_STOCK, poids);

  const clients: Array<{ id: number }> = [];
  for (let i = 0; i < 80; i++) {
    clients.push(
      await prisma.client.create({
        data: {
          ...encryptClientData({
            nom: `Flotte volume ${i + 1}`,
            telephone: `0200${String(200000 + i)}`,
            ville: i % 3 === 0 ? "Abidjan" : i % 3 === 1 ? "Bouaké" : "Yamoussoukro",
            commune: "Volume",
            typeClient: i % 5 === 0 ? "ENTREPRISE" : "PARTICULIER",
          }),
          createurId: opId,
        },
      })
    );
  }

  type Row = {
    numeroSerie: string;
    qrCodeData: string;
    tokenEnregistrement: string;
    typeProduit: TypeProduit;
    produitId: number;
    vitesseLimitation: number | null;
    siteProduction: string;
    statut: StatutPlaque;
    prixReference: number;
    commercialId: number | null;
    createurId: number;
    affecteeLe: Date | null;
    dateFabrication: Date;
  };

  const plaques: Row[] = [];
  let seq = 1;

  function push(produit: (typeof produits)[number], statut: StatutPlaque, index: number) {
    const vendeur = vendeurs[index % vendeurs.length];
    const isLim = produit.famille === "LIMITATION";
    const enStock = statut === "EN_STOCK";
    plaques.push({
      numeroSerie: `${PREFIX}${String(seq).padStart(6, "0")}`,
      qrCodeData: QR,
      tokenEnregistrement: randomBytes(16).toString("hex"),
      typeProduit: isLim ? "LIMITATION_VITESSE" : "STOP",
      produitId: produit.id,
      vitesseLimitation: isLim ? VITESSES[index % VITESSES.length] : null,
      siteProduction: "YP",
      statut,
      prixReference: produit.prixHt,
      commercialId: enStock ? null : vendeur.id,
      createurId: opId,
      affecteeLe: enStock ? null : daysAgo(20 + (index % 120)),
      dateFabrication: daysAgo(30 + (index % 150)),
    });
    seq += 1;
  }

  for (let p = 0; p < produits.length; p++) {
    for (let i = 0; i < nVendues[p]; i++) push(produits[p], "VENDUE", i + p * 97);
    for (let i = 0; i < nAffectees[p]; i++) push(produits[p], "AFFECTEE", i + p * 53);
    for (let i = 0; i < nStock[p]; i++) push(produits[p], "EN_STOCK", i + p * 17);
  }

  console.log(`Insertion de ${plaques.length} plaques...`);
  await chunked(plaques, 400, (batch) => prisma.plaque.createMany({ data: batch }));

  await prisma.compteurSerie.upsert({
    where: { siteCode_datePrefix: { siteCode: "YP", datePrefix: DATE_PREFIX } },
    update: { dernierNum: plaques.length },
    create: { siteCode: "YP", datePrefix: DATE_PREFIX, dernierNum: plaques.length },
  });

  const vendues = await prisma.plaque.findMany({
    where: { numeroSerie: { startsWith: PREFIX }, statut: "VENDUE" },
    select: {
      id: true,
      numeroSerie: true,
      commercialId: true,
      prixReference: true,
      produitId: true,
      dateFabrication: true,
    },
    orderBy: { numeroSerie: "asc" },
  });

  const tauxByProduit = new Map(produits.map((p) => [p.id, p.commissionTaux]));
  const centreByVendeur = new Map(vendeurs.map((v) => [v.id, v.centreControleId]));

  const ventes = vendues.map((p, i) => {
    const taux = tauxByProduit.get(p.produitId ?? 0) ?? 10;
    const prix = p.prixReference;
    const fab = p.dateFabrication;
    const dateVente = new Date(fab);
    dateVente.setDate(dateVente.getDate() + 2 + (i % 12));
    const validite = figerValiditeVente(dateVente, 24);
    return {
      plaqueId: p.id,
      clientId: clients[i % clients.length].id,
      vendeurId: p.commercialId,
      centreId: p.commercialId ? centreByVendeur.get(p.commercialId) ?? null : null,
      canal: "COMMERCIAL" as const,
      prixVente: prix,
      commissionTaux: taux,
      commissionMontant: computeCommission(prix, taux),
      dateVente,
      validiteMois: validite.validiteMois,
      dateExpiration: validite.dateExpiration,
      alerteExpirationJours: validite.alerteExpirationJours,
      dateAlerte: validite.dateAlerte,
    };
  });

  console.log(`Insertion de ${ventes.length} ventes...`);
  await chunked(ventes, 400, (batch) => prisma.vente.createMany({ data: batch }));

  const ventesCreees = await prisma.vente.findMany({
    where: { plaqueId: { in: vendues.map((p) => p.id) } },
    select: { id: true, clientId: true, prixVente: true, dateVente: true, vendeurId: true, plaqueId: true },
    orderBy: { id: "asc" },
  });
  const serieByPlaque = new Map(vendues.map((p) => [p.id, p.numeroSerie]));
  const annee = new Date().getFullYear();
  const compteurFac = await prisma.compteurDocument.upsert({
    where: { type_annee: { type: "FAC", annee } },
    update: {},
    create: { type: "FAC", annee, dernierNum: 0 },
  });
  let facNum = compteurFac.dernierNum;
  const factures = ventesCreees
    .filter((v) => v.prixVente > 0)
    .map((v) => {
      facNum += 1;
      const echeance = new Date(v.dateVente);
      echeance.setDate(echeance.getDate() + 30);
      return {
        numero: `FAC-${annee}-${String(facNum).padStart(5, "0")}`,
        clientId: v.clientId,
        venteId: v.id,
        montantHt: v.prixVente,
        montantTtc: v.prixVente,
        montantPaye: v.prixVente,
        tva: 0,
        statut: "PAYEE" as const,
        dateEmission: v.dateVente,
        dateEcheance: echeance,
        description: `Vente plaque ${serieByPlaque.get(v.plaqueId) ?? v.plaqueId}`,
        createurId: v.vendeurId,
      };
    });
  console.log(`Insertion de ${factures.length} factures...`);
  await chunked(factures, 400, (batch) => prisma.facture.createMany({ data: batch }));
  await prisma.compteurDocument.update({
    where: { type_annee: { type: "FAC", annee } },
    data: { dernierNum: facNum },
  });

  const facturesCreees = await prisma.facture.findMany({
    where: { venteId: { in: ventesCreees.map((v) => v.id) } },
    select: { id: true, clientId: true, montantPaye: true, dateEmission: true },
    orderBy: { id: "asc" },
  });
  const compteurRec = await prisma.compteurDocument.upsert({
    where: { type_annee: { type: "REC", annee } },
    update: {},
    create: { type: "REC", annee, dernierNum: 0 },
  });
  let recNum = compteurRec.dernierNum;
  const recus = facturesCreees
    .filter((f) => f.montantPaye > 0)
    .map((f) => {
      recNum += 1;
      return {
        numero: `REC-${annee}-${String(recNum).padStart(5, "0")}`,
        factureId: f.id,
        clientId: f.clientId,
        montant: f.montantPaye,
        modePaiement: "ESPECES" as const,
        datePaiement: f.dateEmission,
      };
    });
  console.log(`Insertion de ${recus.length} reçus...`);
  await chunked(recus, 400, (batch) => prisma.recuPaiement.createMany({ data: batch }));
  await prisma.compteurDocument.update({
    where: { type_annee: { type: "REC", annee } },
    data: { dernierNum: recNum },
  });

  const agents = await prisma.utilisateur.findMany({
    where: { role: "AGENT_CT", actif: true, identifiant: { startsWith: "agent." } },
    select: { id: true, centreControleId: true },
    take: 400,
  });
  if (agents.length && vendues.length) {
    const commissioned = new Set<number>();
    const verifs = Array.from({ length: 800 }, (_, i) => {
      const plaque = vendues[i % vendues.length];
      const agent = agents[i % agents.length];
      const resultat = (i % 19 === 0 ? "INCONNUE" : i % 41 === 0 ? "CONTREFAITE" : "AUTHENTIQUE") as
        | "AUTHENTIQUE"
        | "INCONNUE"
        | "CONTREFAITE";
      const premiereAuth = resultat === "AUTHENTIQUE" && !commissioned.has(plaque.id);
      if (premiereAuth) commissioned.add(plaque.id);
      const taux = premiereAuth ? (tauxByProduit.get(plaque.produitId ?? 0) ?? 10) : 0;
      return {
        numeroSaisi: plaque.numeroSerie,
        plaqueId: plaque.id,
        agentId: agent.id,
        centreId: agent.centreControleId,
        resultat,
        commissionTaux: taux,
        commissionMontant: premiereAuth ? computeCommission(plaque.prixReference, taux) : 0,
      };
    });
    await prisma.verification.createMany({ data: verifs });
  }

  const parStatut = await prisma.plaque.groupBy({
    by: ["statut"],
    where: { numeroSerie: { startsWith: PREFIX } },
    _count: { _all: true },
  });
  const parFamille = await prisma.plaque.groupBy({
    by: ["produitId", "statut"],
    where: { numeroSerie: { startsWith: PREFIX } },
    _count: { _all: true },
  });

  console.log("Volume chargé.");
  for (const s of parStatut) {
    console.log(`  ${s.statut}: ${s._count._all}`);
  }
  console.log("  Répartition vendues par produit :");
  for (const p of produits) {
    const n = parFamille
      .filter((r) => r.produitId === p.id && r.statut === "VENDUE")
      .reduce((a, r) => a + r._count._all, 0);
    console.log(`    ${p.code.padEnd(16)} ${p.famille.padEnd(20)} ${n}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
