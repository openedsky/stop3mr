/**
 * Territoire national : 1 usine Yopougon + 1000 centres CT + 83 % de vendeurs.
 * Usage : npm run db:seed:territoire
 */
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import {
  CT_SITES_TARGET,
  SITE_PRODUCTION_YOPOUGON,
  VENDEUR_COVERAGE,
  genererCentresCT,
  identitePersonne,
} from "../src/lib/territoire";
import { encryptClientData } from "../src/lib/clients";

const prisma = new PrismaClient();
const PLACEHOLDER_QR =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect fill="#f1f5f9" width="120" height="120"/><text x="60" y="64" text-anchor="middle" font-size="11" fill="#64748b">QR</text></svg>'
  );

async function chunkedCreate<T>(items: T[], size: number, fn: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size));
  }
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = items[index++];
      await fn(current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => worker()));
}

async function main() {
  const vendeurCount = Math.round(CT_SITES_TARGET * VENDEUR_COVERAGE);

  await prisma.siteProduction.updateMany({ data: { actif: false } });
  await prisma.siteProduction.upsert({
    where: { code: SITE_PRODUCTION_YOPOUGON.code },
    update: { ...SITE_PRODUCTION_YOPOUGON, actif: true },
    create: { ...SITE_PRODUCTION_YOPOUGON, actif: true },
  });

  const centres = genererCentresCT(CT_SITES_TARGET);
  await chunkedCreate(centres, 200, (batch) =>
    prisma.centreControle.createMany({
      data: batch.map((c) => ({ ...c, actif: true })),
      skipDuplicates: true,
    })
  );

  await prisma.centreControle.updateMany({
    where: { code: { in: ["CT-ABJ-PL", "CT-ABJ-YP", "CT-BK"] } },
    data: { actif: false },
  });

  const dbCentres = await prisma.centreControle.findMany({
    where: { code: { startsWith: "CT-" }, actif: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, ville: true, commune: true },
  });
  const numbered = dbCentres.filter((c) => /^CT-\d{4}$/.test(c.code));
  if (numbered.length < CT_SITES_TARGET) {
    throw new Error(`Attendu ${CT_SITES_TARGET} centres CT, trouvé ${numbered.length}`);
  }

  const agentsData = numbered.map((c, i) => {
    const identite = identitePersonne(i, "agent");
    return {
      identifiant: `agent.${c.code.slice(3)}`,
      motDePasseHash: "",
      role: "AGENT_CT" as const,
      prenom: identite.prenom,
      nom: identite.nom,
      telephone: `07${String(2000000 + i).padStart(8, "0")}`,
      actif: true,
      centreControleId: c.id,
    };
  });

  const covered = numbered.slice(0, vendeurCount);
  const vendeursData = covered.map((c, i) => {
    const identite = identitePersonne(i, "vendeur");
    return {
      identifiant: `vendeur.${c.code.slice(3)}`,
      motDePasseHash: "",
      role: "COMMERCIAL" as const,
      prenom: identite.prenom,
      nom: identite.nom,
      telephone: `05${String(3000000 + i).padStart(8, "0")}`,
      actif: true,
      centreControleId: c.id,
    };
  });

  console.log("Hachage des mots de passe (= identifiant)…");
  await pool([...agentsData, ...vendeursData], 12, async (user) => {
    user.motDePasseHash = await bcrypt.hash(user.identifiant, 12);
  });

  await chunkedCreate(agentsData, 250, (batch) =>
    prisma.utilisateur.createMany({ data: batch, skipDuplicates: true })
  );
  await chunkedCreate(vendeursData, 250, (batch) =>
    prisma.utilisateur.createMany({ data: batch, skipDuplicates: true })
  );

  const yopougonCt = numbered.find((c) => c.commune === "Yopougon") ?? numbered[0];
  await prisma.utilisateur.updateMany({
    where: { identifiant: { in: ["commercial", "agentct"] } },
    data: { centreControleId: yopougonCt.id },
  });

  const operateur = await prisma.utilisateur.findUnique({ where: { identifiant: "operateur" } });
  const produits = await prisma.produit.findMany({ where: { actif: true }, orderBy: { ordre: "asc" } });
  const vendeurs = await prisma.utilisateur.findMany({
    where: { identifiant: { startsWith: "vendeur." }, actif: true },
    orderBy: { identifiant: "asc" },
    select: { id: true, identifiant: true, centreControleId: true },
  });
  const agents = await prisma.utilisateur.findMany({
    where: { identifiant: { startsWith: "agent." }, actif: true },
    orderBy: { identifiant: "asc" },
    select: { id: true, identifiant: true, centreControleId: true },
  });

  const sampleVendeurs = vendeurs.slice(0, 80);
  const alreadyPlaques = await prisma.plaque.count({ where: { numeroSerie: { startsWith: "R3M-YP-260825-" } } });

  if (alreadyPlaques === 0 && produits.length && operateur && sampleVendeurs.length) {
    const plaques: Array<{
      numeroSerie: string;
      qrCodeData: string;
      tokenEnregistrement: string;
      typeProduit: "STOP" | "LIMITATION_VITESSE";
      produitId: number;
      siteProduction: string;
      statut: "AFFECTEE" | "VENDUE";
      prixReference: number;
      commercialId: number;
      createurId: number;
      affecteeLe: Date;
    }> = [];
    let n = 1;
    for (const v of sampleVendeurs) {
      for (let k = 0; k < 3; k++) {
        const produit = produits[(n + k) % produits.length];
        plaques.push({
          numeroSerie: `R3M-YP-260825-${String(n).padStart(6, "0")}`,
          qrCodeData: PLACEHOLDER_QR,
          tokenEnregistrement: randomBytes(16).toString("hex"),
          typeProduit: produit.famille === "LIMITATION" ? "LIMITATION_VITESSE" : "STOP",
          produitId: produit.id,
          siteProduction: "YP",
          statut: k === 0 ? "VENDUE" : "AFFECTEE",
          prixReference: produit.prixHt,
          commercialId: v.id,
          createurId: operateur.id,
          affecteeLe: new Date(),
        });
        n += 1;
      }
    }
    await chunkedCreate(plaques, 100, (batch) => prisma.plaque.createMany({ data: batch }));

    await prisma.compteurSerie.upsert({
      where: { siteCode_datePrefix: { siteCode: "YP", datePrefix: "260825" } },
      update: { dernierNum: plaques.length },
      create: { siteCode: "YP", datePrefix: "260825", dernierNum: plaques.length },
    });

    const clients: Array<{ id: number }> = [];
    for (let i = 0; i < 12; i++) {
      const client = await prisma.client.create({
        data: {
          ...encryptClientData({
            nom: `Client test ${i + 1}`,
            telephone: `0100${String(100000 + i)}`,
            ville: "Abidjan",
            commune: "Test",
            typeClient: "PARTICULIER",
          }),
          createurId: operateur.id,
        },
      });
      clients.push(client);
    }
    const vendues = await prisma.plaque.findMany({
      where: { numeroSerie: { startsWith: "R3M-YP-260825-" }, statut: "VENDUE" },
      select: { id: true, commercialId: true, prixReference: true, produit: { select: { commissionTaux: true } } },
    });

    const ventes = vendues.map((p, i) => {
      const taux = p.produit?.commissionTaux ?? 10;
      const prix = p.prixReference;
      return {
        plaqueId: p.id,
        clientId: clients[i % clients.length].id,
        vendeurId: p.commercialId,
        centreId: sampleVendeurs.find((v) => v.id === p.commercialId)?.centreControleId ?? null,
        prixVente: prix,
        commissionTaux: taux,
        commissionMontant: Math.round((prix * taux) / 100),
      };
    });
    await prisma.vente.createMany({ data: ventes });

    const verifs = [];
    for (let i = 0; i < 120; i++) {
      const agent = agents[i % Math.min(agents.length, 120)];
      const plaque = vendues[i % vendues.length];
      verifs.push({
        numeroSaisi: `R3M-YP-260825-${String((i % vendues.length) + 1).padStart(6, "0")}`,
        plaqueId: plaque.id,
        agentId: agent.id,
        centreId: agent.centreControleId,
        resultat: (i % 17 === 0 ? "INCONNUE" : i % 31 === 0 ? "CONTREFAITE" : "AUTHENTIQUE") as
          | "AUTHENTIQUE"
          | "INCONNUE"
          | "CONTREFAITE",
      });
    }
    await prisma.verification.createMany({ data: verifs });
  }

  const csvLines = [
    "role;identifiant;mot_de_passe;centre;ville",
    `ADMINISTRATEUR;admin;admin;;`,
    `OPERATEUR;operateur;operateur;;usine Yopougon`,
    `COMMERCIAL;commercial;commercial;${yopougonCt.code};${yopougonCt.commune}`,
    `AGENT_CT;agentct;agentct;${yopougonCt.code};${yopougonCt.commune}`,
    ...covered.map((c) => `COMMERCIAL;vendeur.${c.code.slice(3)};vendeur.${c.code.slice(3)};${c.code};${c.commune}`),
    ...numbered.map((c) => `AGENT_CT;agent.${c.code.slice(3)};agent.${c.code.slice(3)};${c.code};${c.commune}`),
  ];
  const dir = path.join(process.cwd(), "prisma", "data");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "comptes-test.csv"), csvLines.join("\n"), "utf8");

  const usine = await prisma.siteProduction.count({ where: { actif: true } });
  const ct = await prisma.centreControle.count({ where: { actif: true, code: { startsWith: "CT-" } } });
  const nbV = await prisma.utilisateur.count({ where: { role: "COMMERCIAL", actif: true, identifiant: { startsWith: "vendeur." } } });
  const nbA = await prisma.utilisateur.count({ where: { role: "AGENT_CT", actif: true, identifiant: { startsWith: "agent." } } });
  const couverts = await prisma.centreControle.count({
    where: { actif: true, code: { startsWith: "CT-" }, agents: { some: { role: "COMMERCIAL", actif: true } } },
  });

  console.log("Territoire chargé.");
  console.log(`  Usine production active : ${usine} (YP Yopougon)`);
  console.log(`  Centres CT actifs       : ${ct}`);
  console.log(`  Vendeurs test           : ${nbV}  (${((couverts / ct) * 100).toFixed(1)} % des sites)`);
  console.log(`  Agents CT test          : ${nbA}`);
  console.log(`  Mot de passe            : identique à l'identifiant`);
  console.log(`  Fichier comptes         : prisma/data/comptes-test.csv`);
  console.log(`  Exemples                : vendeur.0001 / vendeur.0001`);
  console.log(`                            agent.0001 / agent.0001`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
