/**
 * Aligne le jeu de données de test sur les règles métier actuelles.
 * Usage : npm run db:repair:test
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function chunked<T>(items: T[], size: number, fn: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size));
  }
}

async function main() {
  const zeroAvant = await prisma.vente.count({ where: { prixVente: { lte: 0 } } });
  const orphelinesAvant = await prisma.facture.count({ where: { venteId: null } });

  const corrigees = await prisma.$executeRaw`
    UPDATE ventes v
    INNER JOIN plaques p ON p.id = v.plaque_id
    LEFT JOIN utilisateurs u ON u.id = v.vendeur_id
    SET
      v.prix_vente = CASE
        WHEN v.prix_vente <= 0 THEN GREATEST(COALESCE(p.prix_reference, 0), 0)
        ELSE v.prix_vente
      END,
      v.canal = CASE
        WHEN u.role IN ('OPERATEUR', 'ADMINISTRATEUR') THEN 'DIRECTE'
        ELSE v.canal
      END,
      v.commission_taux = CASE
        WHEN u.role IN ('OPERATEUR', 'ADMINISTRATEUR') THEN 0
        ELSE v.commission_taux
      END,
      v.commission_montant = CASE
        WHEN u.role IN ('OPERATEUR', 'ADMINISTRATEUR') THEN 0
        ELSE v.commission_montant
      END
    WHERE v.prix_vente <= 0
       OR u.role IN ('OPERATEUR', 'ADMINISTRATEUR')
  `;

  await prisma.$executeRaw`
    UPDATE ventes v
    INNER JOIN plaques p ON p.id = v.plaque_id
    LEFT JOIN produits pr ON pr.id = p.produit_id
    SET
      v.commission_taux = COALESCE(pr.commission_taux, 10),
      v.commission_montant = ROUND(v.prix_vente * COALESCE(pr.commission_taux, 10) / 100)
    WHERE v.canal = 'COMMERCIAL'
      AND v.prix_vente > 0
      AND v.commission_montant = 0
      AND v.vendeur_id IS NOT NULL
  `;

  const authStock = await prisma.verification.deleteMany({
    where: {
      resultat: "AUTHENTIQUE",
      OR: [{ plaqueId: null }, { plaque: { statut: { not: "VENDUE" } } }],
    },
  });

  const recusOrphelins = await prisma.recuPaiement.deleteMany({
    where: { facture: { venteId: null } },
  });
  const facturesOrphelines = await prisma.facture.deleteMany({ where: { venteId: null } });

  const sansFacture = await prisma.vente.findMany({
    where: { facture: null, prixVente: { gt: 0 } },
    select: {
      id: true,
      clientId: true,
      prixVente: true,
      dateVente: true,
      vendeurId: true,
      plaque: { select: { numeroSerie: true } },
    },
    orderBy: { id: "asc" },
  });

  const compteur = await prisma.compteurDocument.findUnique({
    where: { type_annee: { type: "FAC", annee: 2026 } },
  });
  let nextNum = (compteur?.dernierNum ?? 0) + 1;
  const existants = await prisma.facture.findMany({
    where: { numero: { startsWith: "FAC-2026-" } },
    select: { numero: true },
  });
  const pris = new Set(existants.map((f) => f.numero));
  function nextNumero() {
    let numero = `FAC-2026-${String(nextNum).padStart(5, "0")}`;
    while (pris.has(numero)) {
      nextNum += 1;
      numero = `FAC-2026-${String(nextNum).padStart(5, "0")}`;
    }
    pris.add(numero);
    nextNum += 1;
    return numero;
  }

  const rows = sansFacture.map((v) => {
    const echeance = new Date(v.dateVente);
    echeance.setDate(echeance.getDate() + 30);
    return {
      numero: nextNumero(),
      clientId: v.clientId,
      venteId: v.id,
      montantHt: v.prixVente,
      montantTtc: v.prixVente,
      montantPaye: 0,
      tva: 0,
      statut: "EMISE" as const,
      dateEmission: v.dateVente,
      dateEcheance: echeance,
      description: `Vente plaque ${v.plaque.numeroSerie}`,
      createurId: v.vendeurId,
    };
  });

  await chunked(rows, 400, (batch) => prisma.facture.createMany({ data: batch }));
  await prisma.compteurDocument.upsert({
    where: { type_annee: { type: "FAC", annee: 2026 } },
    update: { dernierNum: nextNum - 1 },
    create: { type: "FAC", annee: 2026, dernierNum: nextNum - 1 },
  });

  const seriesPayees = [
    "R3M-PR-250823-900001",
    "R3M-BK-250823-900007",
    "R3M-PR-250823-900003",
    "R3M-YK-250823-900004",
    "R3M-YK-250823-900011",
    "R3M-BK-250823-900008",
  ];
  const demoPayees = await prisma.vente.findMany({
    where: { plaque: { numeroSerie: { in: seriesPayees } } },
    select: {
      clientId: true,
      prixVente: true,
      plaque: { select: { numeroSerie: true } },
      facture: { select: { id: true } },
    },
  });
  const demoPartielle = await prisma.vente.findFirst({
    where: { plaque: { numeroSerie: "R3M-YK-250823-900005" } },
    select: { clientId: true, prixVente: true, facture: { select: { id: true } } },
  });

  const operateur = await prisma.utilisateur.findUnique({ where: { identifiant: "operateur" } });
  const admin = await prisma.utilisateur.findUnique({ where: { identifiant: "admin" } });
  const createurId = operateur?.id ?? admin?.id ?? null;

  for (const v of demoPayees) {
    if (!v.facture) continue;
    await prisma.facture.update({
      where: { id: v.facture.id },
      data: { statut: "PAYEE", montantPaye: v.prixVente },
    });
  }
  if (demoPartielle?.facture) {
    const paye = Math.min(1500, demoPartielle.prixVente);
    await prisma.facture.update({
      where: { id: demoPartielle.facture.id },
      data: { statut: "PARTIELLEMENT_PAYEE", montantPaye: paye },
    });
  }

  await prisma.recuPaiement.deleteMany({
    where: { numero: { in: ["REC-2026-90001", "REC-2026-90002", "REC-2026-90003"] } },
  });

  const parSerie = new Map(demoPayees.map((v) => [v.plaque.numeroSerie, v]));
  const recus: Array<{
    numero: string;
    factureId: number;
    clientId: number;
    montant: number;
    modePaiement: "MOBILE_MONEY" | "VIREMENT" | "CHEQUE";
    reference: string;
  }> = [];
  const r1 = parSerie.get("R3M-PR-250823-900001");
  if (r1?.facture) {
    recus.push({
      numero: "REC-2026-90001",
      factureId: r1.facture.id,
      clientId: r1.clientId,
      montant: r1.prixVente,
      modePaiement: "MOBILE_MONEY",
      reference: "WAVE-7845219034",
    });
  }
  if (demoPartielle?.facture) {
    recus.push({
      numero: "REC-2026-90002",
      factureId: demoPartielle.facture.id,
      clientId: demoPartielle.clientId,
      montant: Math.min(1500, demoPartielle.prixVente),
      modePaiement: "VIREMENT",
      reference: "VIR-SGBCI-20260815",
    });
  }
  const r3 = parSerie.get("R3M-BK-250823-900008");
  if (r3?.facture) {
    recus.push({
      numero: "REC-2026-90003",
      factureId: r3.facture.id,
      clientId: r3.clientId,
      montant: r3.prixVente,
      modePaiement: "CHEQUE",
      reference: "CHQ-458712",
    });
  }
  if (recus.length) {
    const now = new Date();
    const d1 = new Date(now);
    d1.setDate(d1.getDate() - 10);
    await prisma.recuPaiement.createMany({
      data: recus.map((r, i) => ({
        ...r,
        datePaiement: i === 0 ? d1 : now,
        createurId,
      })),
    });
  }

  const zeroApres = await prisma.vente.count({ where: { prixVente: { lte: 0 } } });
  const orphelinesApres = await prisma.facture.count({ where: { venteId: null } });
  const sansFacApres = await prisma.vente.count({ where: { facture: null, prixVente: { gt: 0 } } });
  const ca = await prisma.vente.aggregate({ _sum: { prixVente: true } });
  const ttc = await prisma.facture.aggregate({ _sum: { montantTtc: true, montantPaye: true } });
  const authStockApres = await prisma.verification.count({
    where: { resultat: "AUTHENTIQUE", plaque: { statut: { not: "VENDUE" } } },
  });
  const canalDirecte = await prisma.vente.count({ where: { canal: "DIRECTE" } });

  console.log("Réparation données test terminée.");
  console.log(`  Ventes prix 0 : ${zeroAvant} → ${zeroApres}`);
  console.log(`  Lignes ventes corrigées (prix/canal) : ${corrigees}`);
  console.log(`  AUTHENTIQUE hors VENDUE supprimés : ${authStock.count}`);
  console.log(
    `  Factures orphelines : ${orphelinesAvant} → ${orphelinesApres} (reçus ${recusOrphelins.count}, factures ${facturesOrphelines.count})`
  );
  console.log(`  Factures créées : ${rows.length} ; ventes > 0 sans facture : ${sansFacApres}`);
  console.log(
    `  CA ventes ${ca._sum.prixVente ?? 0} / TTC factures ${ttc._sum.montantTtc ?? 0} / encaissé ${ttc._sum.montantPaye ?? 0}`
  );
  console.log(`  Ventes DIRECTE : ${canalDirecte} ; AUTHENTIQUE stock restant : ${authStockApres}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
