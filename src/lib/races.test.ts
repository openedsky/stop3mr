import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { encryptClientData } from "./clients";
import { createPaiementCommission } from "./commissions";
import { rateLimitPersistent } from "./rate-limit";
import { figerValiditeVente } from "./validite";

const stamp = `RACE${Date.now().toString(36).toUpperCase()}`;
const seriePay = `R3M-RC-${stamp}-P`;
const serieCt = `R3M-RC-${stamp}-C`;
const identVendeur = `race.vendeur.${stamp.toLowerCase()}`;
const identAgent = `race.agent.${stamp.toLowerCase()}`;

const ids = {
  vendeur: 0,
  agent: 0,
  client: 0,
  plaquePay: 0,
  plaqueCt: 0,
  ventePay: 0,
};

async function cleanup() {
  await prisma.paiementCommission.deleteMany({
    where: { utilisateur: { identifiant: { in: [identVendeur, identAgent] } } },
  });
  await prisma.verification.deleteMany({
    where: { plaque: { numeroSerie: { in: [seriePay, serieCt] } } },
  });
  await prisma.recuPaiement.deleteMany({
    where: { facture: { vente: { plaque: { numeroSerie: { in: [seriePay, serieCt] } } } } },
  });
  await prisma.facture.deleteMany({
    where: { vente: { plaque: { numeroSerie: { in: [seriePay, serieCt] } } } },
  });
  await prisma.vente.deleteMany({
    where: { plaque: { numeroSerie: { in: [seriePay, serieCt] } } },
  });
  await prisma.plaque.deleteMany({ where: { numeroSerie: { in: [seriePay, serieCt] } } });
  await prisma.client.deleteMany({
    where: { id: ids.client || undefined, createur: { identifiant: identVendeur } },
  });
  if (ids.client) {
    await prisma.client.deleteMany({ where: { id: ids.client } });
  }
  await prisma.journalAudit.deleteMany({
    where: { utilisateur: { identifiant: { in: [identVendeur, identAgent] } } },
  });
  await prisma.utilisateur.deleteMany({
    where: { identifiant: { in: [identVendeur, identAgent] } },
  });
}

describe("courses MariaDB (API)", () => {
  after(cleanup);

  it("un seul paiement commission gagne sous concurrence", async () => {
    const [produit, site, admin] = await Promise.all([
      prisma.produit.findFirst({ where: { actif: true }, orderBy: { id: "asc" } }),
      prisma.siteProduction.findFirst({ where: { actif: true } }),
      prisma.utilisateur.findFirst({ where: { role: "ADMINISTRATEUR", actif: true } }),
    ]);
    assert.ok(produit && site && admin);

    const vendeur = await prisma.utilisateur.create({
      data: {
        identifiant: identVendeur,
        motDePasseHash: "$2b$12$wahqxeF6yJ0c59tf2.N7Bu5C5H1fMFFbE7q9sQ1ojsw.L3Bh5U71S",
        role: "COMMERCIAL",
        prenom: "Race",
        nom: "Vendeur",
        actif: true,
      },
    });
    ids.vendeur = vendeur.id;

    const client = await prisma.client.create({
      data: {
        ...encryptClientData({
          nom: `Client race ${stamp}`,
          telephone: `0999${stamp.slice(-6).padStart(6, "0")}`,
        }),
        createurId: admin.id,
      },
    });
    ids.client = client.id;

    const plaque = await prisma.plaque.create({
      data: {
        numeroSerie: seriePay,
        qrCodeData: "race",
        tokenEnregistrement: randomBytes(16).toString("hex"),
        typeProduit: produit.famille === "LIMITATION" ? "LIMITATION_VITESSE" : "STOP",
        produitId: produit.id,
        siteProduction: site.code,
        statut: "VENDUE",
        prixReference: 3000,
        createurId: admin.id,
      },
    });
    ids.plaquePay = plaque.id;

    const achat = new Date();
    const validite = figerValiditeVente(achat, 24, 30);
    const vente = await prisma.vente.create({
      data: {
        plaqueId: plaque.id,
        clientId: client.id,
        vendeurId: vendeur.id,
        canal: "COMMERCIAL",
        prixVente: 3000,
        commissionTaux: 10,
        commissionMontant: 300,
        dateVente: achat,
        validiteMois: validite.validiteMois,
        dateExpiration: validite.dateExpiration,
        alerteExpirationJours: validite.alerteExpirationJours,
        dateAlerte: validite.dateAlerte,
      },
    });
    ids.ventePay = vente.id;

    const from = new Date(achat.getTime() - 60_000);
    const to = new Date(achat.getTime() + 60_000);
    const pay = () =>
      prisma.$transaction(
        (tx) =>
          createPaiementCommission(
            {
              type: "VENTE",
              utilisateurId: vendeur.id,
              periodeDebut: from,
              periodeFin: to,
              modePaiement: "ESPECES",
              createurId: admin.id,
            },
            tx
          ),
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20000 }
      );

    const results = await Promise.allSettled([pay(), pay()]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const ko = results.filter((r) => r.status === "rejected");
    assert.equal(ok.length, 1);
    assert.equal(ko.length, 1);

    const payes = await prisma.vente.count({
      where: { id: vente.id, paiementCommissionId: { not: null } },
    });
    assert.equal(payes, 1);
    const nPay = await prisma.paiementCommission.count({
      where: { utilisateurId: vendeur.id, type: "VENTE" },
    });
    assert.equal(nPay, 1);
  });

  it("le second AUTHENTIQUE concurrent se fait rejeter (unique)", async () => {
    const [produit, site, admin] = await Promise.all([
      prisma.produit.findFirst({ where: { actif: true }, orderBy: { id: "asc" } }),
      prisma.siteProduction.findFirst({ where: { actif: true } }),
      prisma.utilisateur.findFirst({ where: { role: "ADMINISTRATEUR", actif: true } }),
    ]);
    assert.ok(produit && site && admin);

    const agent = await prisma.utilisateur.upsert({
      where: { identifiant: identAgent },
      update: {},
      create: {
        identifiant: identAgent,
        motDePasseHash: "$2b$12$wahqxeF6yJ0c59tf2.N7Bu5C5H1fMFFbE7q9sQ1ojsw.L3Bh5U71S",
        role: "AGENT_CT",
        prenom: "Race",
        nom: "Agent",
        actif: true,
      },
    });
    ids.agent = agent.id;

    const client =
      ids.client > 0
        ? { id: ids.client }
        : await prisma.client.create({
            data: {
              ...encryptClientData({
                nom: `Client race ct ${stamp}`,
                telephone: `0888${stamp.slice(-6).padStart(6, "0")}`,
              }),
              createurId: admin.id,
            },
          });
    ids.client = client.id;

    const plaque = await prisma.plaque.create({
      data: {
        numeroSerie: serieCt,
        qrCodeData: "race-ct",
        tokenEnregistrement: randomBytes(16).toString("hex"),
        typeProduit: produit.famille === "LIMITATION" ? "LIMITATION_VITESSE" : "STOP",
        produitId: produit.id,
        siteProduction: site.code,
        statut: "VENDUE",
        prixReference: 3000,
        createurId: admin.id,
      },
    });
    ids.plaqueCt = plaque.id;

    const achat = new Date();
    const validite = figerValiditeVente(achat, 24, 30);
    await prisma.vente.create({
      data: {
        plaqueId: plaque.id,
        clientId: client.id,
        canal: "DIRECTE",
        prixVente: 3000,
        dateVente: achat,
        validiteMois: validite.validiteMois,
        dateExpiration: validite.dateExpiration,
        alerteExpirationJours: validite.alerteExpirationJours,
        dateAlerte: validite.dateAlerte,
      },
    });

    const insert = () =>
      prisma.verification.create({
        data: {
          numeroSaisi: serieCt,
          plaqueId: plaque.id,
          agentId: agent.id,
          resultat: "AUTHENTIQUE",
          commissionTaux: 10,
          commissionMontant: 300,
          commissionAuthPlaqueId: plaque.id,
        },
      });

    const results = await Promise.allSettled([insert(), insert()]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const ko = results.filter((r) => r.status === "rejected");
    assert.equal(ok.length, 1);
    assert.equal(ko.length, 1);
    const rejected = ko[0] as PromiseRejectedResult;
    assert.equal((rejected.reason as { code?: string }).code, "P2002");
  });

  it("rateLimitPersistent est atomique sous concurrence", async () => {
    const key = `race-rl:${stamp}`;
    await prisma.rateLimitBucket.deleteMany({ where: { cle: key } });
    const hits = await Promise.all(
      Array.from({ length: 8 }, () => rateLimitPersistent(key, 5, 60_000))
    );
    const accepted = hits.filter((h) => h.success).length;
    const denied = hits.filter((h) => !h.success).length;
    assert.equal(accepted, 5);
    assert.equal(denied, 3);
    await prisma.rateLimitBucket.deleteMany({ where: { cle: key } });
  });
});
