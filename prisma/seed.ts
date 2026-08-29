import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import { CATALOGUE_PRODUITS } from "../src/lib/catalog-data";
import { SITE_PRODUCTION_YOPOUGON } from "../src/lib/territoire";

const prisma = new PrismaClient();

async function main() {
  const [adminHash, operatorHash, commercialHash, agentHash] = await Promise.all([
    bcrypt.hash("admin", 12),
    bcrypt.hash("operateur", 12),
    bcrypt.hash("commercial", 12),
    bcrypt.hash("agentct", 12),
  ]);

  await prisma.utilisateur.upsert({
    where: { identifiant: "admin" },
    update: { prenom: "Jean", nom: "Kouassi", motDePasseHash: adminHash },
    create: {
      identifiant: "admin",
      motDePasseHash: adminHash,
      role: "ADMINISTRATEUR",
      prenom: "Jean",
      nom: "Kouassi",
    },
  });

  await prisma.utilisateur.upsert({
    where: { identifiant: "operateur" },
    update: { prenom: "Koffi", nom: "N'Guessan", motDePasseHash: operatorHash },
    create: {
      identifiant: "operateur",
      motDePasseHash: operatorHash,
      role: "OPERATEUR",
      prenom: "Koffi",
      nom: "N'Guessan",
    },
  });

  await prisma.siteProduction.updateMany({
    where: { code: { not: SITE_PRODUCTION_YOPOUGON.code } },
    data: { actif: false },
  });

  const sites = [SITE_PRODUCTION_YOPOUGON];

  for (const site of sites) {
    await prisma.siteProduction.upsert({
      where: { code: site.code },
      update: { ...site, actif: true },
      create: { ...site, actif: true },
    });
  }

  const centres = [
    {
      code: "CT-ABJ-PL",
      libelle: "Centre de contrôle technique Plateau",
      pays: "Côte d'Ivoire",
      ville: "Abidjan",
      commune: "Plateau",
      quartier: "Commerce",
      adresse: "Boulevard de la République, immeuble face à la Poste",
      latitude: 5.32385,
      longitude: -4.01972,
    },
    {
      code: "CT-ABJ-YP",
      libelle: "Centre de contrôle technique Yopougon",
      pays: "Côte d'Ivoire",
      ville: "Abidjan",
      commune: "Yopougon",
      quartier: "Sicogi",
      adresse: "Boulevard Principal, à proximité de la gare de Yopougon",
      latitude: 5.33694,
      longitude: -4.08531,
    },
    {
      code: "CT-BK",
      libelle: "Centre de contrôle technique Bouaké",
      pays: "Côte d'Ivoire",
      ville: "Bouaké",
      commune: "Bouaké",
      quartier: "Commerce",
      adresse: "Avenue Houphouët-Boigny, centre-ville",
      latitude: 7.68956,
      longitude: -5.03028,
    },
  ];

  for (const centre of centres) {
    await prisma.centreControle.upsert({
      where: { code: centre.code },
      update: {
        libelle: centre.libelle,
        pays: centre.pays,
        ville: centre.ville,
        commune: centre.commune,
        quartier: centre.quartier,
        adresse: centre.adresse,
        latitude: centre.latitude,
        longitude: centre.longitude,
        actif: true,
      },
      create: centre,
    });
  }

  const centreDemo =
    (await prisma.centreControle.findFirst({
      where: { actif: true, code: { startsWith: "CT-" } },
      orderBy: { code: "asc" },
    })) ?? (await prisma.centreControle.findUnique({ where: { code: "CT-ABJ-PL" } }));

  await prisma.utilisateur.upsert({
    where: { identifiant: "commercial" },
    update: { role: "COMMERCIAL", prenom: "Kouadio", nom: "Yao", centreControleId: centreDemo?.id ?? null, motDePasseHash: commercialHash },
    create: {
      identifiant: "commercial",
      motDePasseHash: commercialHash,
      role: "COMMERCIAL",
      prenom: "Kouadio",
      nom: "Yao",
      telephone: "0700000001",
      centreControleId: centreDemo?.id ?? null,
    },
  });

  await prisma.utilisateur.upsert({
    where: { identifiant: "agentct" },
    update: { role: "AGENT_CT", prenom: "Awa", nom: "Traoré", centreControleId: centreDemo?.id ?? null, motDePasseHash: agentHash },
    create: {
      identifiant: "agentct",
      motDePasseHash: agentHash,
      role: "AGENT_CT",
      prenom: "Awa",
      nom: "Traoré",
      telephone: "0700000002",
      centreControleId: centreDemo?.id ?? null,
    },
  });

  for (const produit of CATALOGUE_PRODUITS) {
    await prisma.produit.upsert({
      where: { code: produit.code },
      update: {
        libelle: produit.libelle,
        description: produit.description,
        famille: produit.famille,
        dimensions: produit.dimensions,
        visibilite: produit.visibilite,
        prixHt: produit.prixHt,
        usagePrincipal: produit.usagePrincipal,
        vitessesDisponibles: produit.vitessesDisponibles,
        barre: produit.barre,
        imagePath: produit.imagePath,
        ordre: produit.ordre,
      },
      create: produit,
    });
  }

  const rouge = await prisma.produit.findUnique({ where: { code: "ROUGE-1240" } });
  const lim = await prisma.produit.findUnique({ where: { code: "LIM-GRIS-BARRE" } });

  if (rouge) {
    await prisma.plaque.updateMany({
      where: { produitId: null, typeProduit: "STOP" },
      data: { produitId: rouge.id, prixReference: rouge.prixHt },
    });
  }
  if (lim) {
    await prisma.plaque.updateMany({
      where: { produitId: null, typeProduit: "LIMITATION_VITESSE" },
      data: { produitId: lim.id, prixReference: lim.prixHt },
    });
  }

  await prisma.parametre.upsert({
    where: { cle: "compte_contribuable" },
    update: {},
    create: {
      cle: "compte_contribuable",
      valeur: process.env.COMPTE_CONTRIBUABLE ?? "CI-XXXXX",
    },
  });

  await prisma.parametre.upsert({
    where: { cle: "prix_reference_fcfa" },
    update: {},
    create: { cle: "prix_reference_fcfa", valeur: "3000" },
  });

  await prisma.parametre.upsert({
    where: { cle: "stock_seuil_alerte" },
    update: {},
    create: { cle: "stock_seuil_alerte", valeur: "10" },
  });

  await prisma.parametre.upsert({
    where: { cle: "commission_taux_defaut" },
    update: {},
    create: { cle: "commission_taux_defaut", valeur: "10" },
  });

  await prisma.parametre.upsert({
    where: { cle: "commission_taux_controleur_defaut" },
    update: {},
    create: { cle: "commission_taux_controleur_defaut", valeur: "10" },
  });

  await prisma.parametre.upsert({
    where: { cle: "plaque_validite_mois" },
    update: {},
    create: { cle: "plaque_validite_mois", valeur: "24" },
  });

  await prisma.parametre.upsert({
    where: { cle: "plaque_alerte_expiration_jours" },
    update: {},
    create: { cle: "plaque_alerte_expiration_jours", valeur: "30" },
  });

  const qrParams = [
    ["qr_environment", "localhost"],
    ["qr_url_localhost", process.env.APP_PUBLIC_URL ?? "http://localhost:3000"],
    ["qr_url_production", "https://stop3mr.ci"],
    ["qr_verify_path", "/verify"],
  ] as const;

  for (const [cle, valeur] of qrParams) {
    await prisma.parametre.upsert({
      where: { cle },
      update: {},
      create: { cle, valeur },
    });
  }

  const plaquesSansToken = await prisma.plaque.findMany({
    where: { tokenEnregistrement: null, statut: "EN_STOCK" },
    select: { id: true },
  });

  for (const p of plaquesSansToken) {
    await prisma.plaque.update({
      where: { id: p.id },
      data: { tokenEnregistrement: randomBytes(32).toString("hex") },
    });
  }

  const commercialUser = await prisma.utilisateur.findUnique({ where: { identifiant: "commercial" } });
  if (commercialUser) {
    const dejaAffecte = await prisma.plaque.count({
      where: { commercialId: commercialUser.id, statut: "AFFECTEE" },
    });
    if (dejaAffecte === 0) {
      const dispo = await prisma.plaque.findMany({
        where: { statut: "EN_STOCK" },
        select: { id: true },
        take: 30,
        orderBy: { dateFabrication: "asc" },
      });
      if (dispo.length > 0) {
        const now = new Date();
        await prisma.plaque.updateMany({
          where: { id: { in: dispo.map((x) => x.id) } },
          data: { statut: "AFFECTEE", commercialId: commercialUser.id, affecteeLe: now },
        });
        await prisma.affectationStock.createMany({
          data: dispo.map((x) => ({
            plaqueId: x.id,
            commercialId: commercialUser.id,
          })),
        });
      }
    }
  }

  console.log("Seed terminé.");
  console.log("  Admin       : admin / admin");
  console.log("  Opérateur   : operateur / operateur");
  console.log("  Commercial  : commercial / commercial");
  console.log("  Agent CT    : agentct / agentct");
  console.log(`  Sites       : ${sites.map((s) => s.code).join(", ")}`);
  console.log(`  Catalogue   : ${CATALOGUE_PRODUITS.length} produits`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
