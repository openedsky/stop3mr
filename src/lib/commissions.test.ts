import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { commissionControleAuthentique } from "./commission-ct";
import { figerTarifVente } from "./tarif";
import { figerValiditeVente, filtresExpirationFigee, statutDepuisExpiration } from "./validite";
import { sameClientIdentity, normalizePersonName, normalizePhoneDigits, searchHash } from "./clients";
import { autoriserVenteInterne, paiementMarquageConflit } from "./vente-regles";
import { wherePlaquesListe } from "./plaque-scope";

describe("commissionControleAuthentique", () => {
  it("refuse si plaque non vendue, déjà commissionnée ou prix 0", () => {
    const base = { resultat: "AUTHENTIQUE", plaqueVendue: true, dejaCommissionnee: false, prixVente: 3000, taux: 10 };
    assert.equal(commissionControleAuthentique({ ...base, plaqueVendue: false }).commissionMontant, 0);
    assert.equal(commissionControleAuthentique({ ...base, dejaCommissionnee: true }).commissionMontant, 0);
    assert.equal(commissionControleAuthentique({ ...base, prixVente: 0 }).commissionMontant, 0);
    assert.equal(commissionControleAuthentique({ ...base, resultat: "INCONNUE" }).commissionMontant, 0);
  });

  it("calcule 10 % sur une plaque vendue AUTHENTIQUE", () => {
    const c = commissionControleAuthentique({
      resultat: "AUTHENTIQUE",
      plaqueVendue: true,
      dejaCommissionnee: false,
      prixVente: 3000,
      taux: 10,
    });
    assert.equal(c.commissionTaux, 10);
    assert.equal(c.commissionMontant, 300);
  });
});

describe("figerTarifVente", () => {
  it("annule la commission en vente directe", () => {
    const t = figerTarifVente({
      prixCatalogue: 3000,
      prixReference: 2500,
      commissionTauxCatalogue: 10,
      avecCommission: false,
    });
    assert.equal(t.prixVente, 3000);
    assert.equal(t.commissionMontant, 0);
  });

  it("fige catalogue + commission commerciale", () => {
    const t = figerTarifVente({
      prixCatalogue: 3000,
      prixReference: 2500,
      commissionTauxCatalogue: 10,
      avecCommission: true,
    });
    assert.equal(t.prixVente, 3000);
    assert.equal(t.commissionMontant, 300);
  });
});

describe("validite figée", () => {
  it("pose dateExpiration et dateAlerte à la vente", () => {
    const achat = new Date("2026-08-29T00:00:00.000Z");
    const v = figerValiditeVente(achat, 24, 30);
    assert.equal(v.validiteMois, 24);
    assert.ok(v.dateExpiration > achat);
    assert.ok(v.dateAlerte < v.dateExpiration);
    assert.equal(v.alerteExpirationJours, 30);
  });

  it("classe expire bientôt sur le délai figé", () => {
    const exp = new Date();
    exp.setDate(exp.getDate() + 10);
    const s = statutDepuisExpiration(exp, 30);
    assert.equal(s.statut, "EXPIRE_BIENTOT");
    const filtres = filtresExpirationFigee();
    assert.ok(filtres.expireBientot.AND);
  });
});

describe("POST /api/ventes — règles de stock", () => {
  it("refuse DIRECTE sur une plaque AFFECTEE", () => {
    const d = autoriserVenteInterne({
      role: "ADMINISTRATEUR",
      canal: "DIRECTE",
      plaqueStatut: "AFFECTEE",
      plaqueCommercialId: 12,
      userId: 1,
    });
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.status, 409);
  });

  it("refuse un commercial hors de son stock", () => {
    const d = autoriserVenteInterne({
      role: "COMMERCIAL",
      canal: "COMMERCIAL",
      plaqueStatut: "EN_STOCK",
      plaqueCommercialId: null,
      userId: 7,
    });
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.status, 403);
  });

  it("autorise DIRECTE depuis EN_STOCK", () => {
    const d = autoriserVenteInterne({
      role: "ADMINISTRATEUR",
      canal: "DIRECTE",
      plaqueStatut: "EN_STOCK",
      plaqueCommercialId: null,
      userId: 1,
    });
    assert.equal(d.ok, true);
  });
});

describe("POST /api/controle/verifications — unicité AUTHENTIQUE", () => {
  it("le second AUTHENTIQUE ne crée pas de commission (409 seulement en course unique)", () => {
    const second = commissionControleAuthentique({
      resultat: "AUTHENTIQUE",
      plaqueVendue: true,
      dejaCommissionnee: true,
      prixVente: 3000,
      taux: 10,
    });
    assert.equal(second.commissionMontant, 0);
  });
});

describe("POST /api/commissions/paiements — marquage FOR UPDATE", () => {
  it("détecte un paiement concurrent (updateMany partiel)", () => {
    assert.equal(paiementMarquageConflit(3, 4), true);
    assert.equal(paiementMarquageConflit(4, 4), false);
  });
});

describe("GET /api/plaques — isolation commercial", () => {
  it("la recherche q ne lève pas le filtre vendeur", () => {
    const where = wherePlaquesListe({
      role: "COMMERCIAL",
      userId: 7,
      q: "R3M-PR",
    });
    const and = where.AND as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(and));
    const scope = JSON.stringify(and[0]);
    assert.ok(scope.includes("\"userId\":7") || scope.includes("7"));
    assert.equal(JSON.stringify(and[1]), JSON.stringify({ numeroSerie: { contains: "R3M-PR" } }));
  });

  it("un commercial ne voit EN_STOCK que via son stock AFFECTEE", () => {
    const where = wherePlaquesListe({
      role: "COMMERCIAL",
      userId: 7,
      statut: "EN_STOCK",
    });
    assert.equal(where.statut, "AFFECTEE");
    assert.equal(where.commercialId, 7);
    assert.equal(where.OR, undefined);
  });
});

describe("searchHash", () => {
  it("refuse une ENCRYPTION_KEY absente ou trop courte", () => {
    const prev = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      assert.throws(() => searchHash("kouassi"), /ENCRYPTION_KEY/);
    } finally {
      if (prev !== undefined) process.env.ENCRYPTION_KEY = prev;
    }
  });
});

describe("identité client", () => {
  it("normalise nom et téléphone", () => {
    assert.equal(normalizePersonName("Kouassi  Jean"), "kouassi jean");
    assert.equal(normalizePhoneDigits("+225 07 01 02 03 04"), "0701020304");
    assert.ok(
      sameClientIdentity(
        { nom: "Kouassi Jean", telephone: "0701020304" },
        { nom: "KOUASSI  JEAN", telephone: "2250701020304" }
      )
    );
  });
});
