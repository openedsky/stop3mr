import { Prisma, TypeCommission } from "@prisma/client";
import { prisma } from "./db";
import { computeCommission } from "./money";
import { generateDocumentNumber } from "./crm";
import { getMetierSettings } from "./metier";
import { paiementMarquageConflit } from "./vente-regles";
export { commissionControleAuthentique } from "./commission-ct";

type Tx = Prisma.TransactionClient;

export async function tauxCommissionControleur(
  produitTaux: number | null | undefined,
  fallback?: number
): Promise<number> {
  if (produitTaux != null && Number.isFinite(produitTaux)) return produitTaux;
  if (fallback != null) return fallback;
  const settings = await getMetierSettings();
  return settings.commissionTauxControleurDefaut;
}

/** Annule les commissions AUTHENTIQUE en trop (doublons, plaque non vendue). Ne touche pas les lignes déjà payées. */
export async function normaliserCommissionsControle(tx?: Tx) {
  const client = tx ?? prisma;
  await client.$executeRaw`
    UPDATE verifications v
    LEFT JOIN plaques p ON p.id = v.plaque_id
    LEFT JOIN ventes ve ON ve.plaque_id = p.id
    SET v.commission_taux = 0, v.commission_montant = 0
    WHERE v.resultat = 'AUTHENTIQUE'
      AND v.paiement_commission_id IS NULL
      AND v.commission_montant > 0
      AND (v.plaque_id IS NULL OR p.statut <> 'VENDUE' OR ve.id IS NULL OR ve.prix_vente <= 0)
  `;
  await client.$executeRaw`
    UPDATE verifications v
    INNER JOIN (
      SELECT plaque_id, MIN(id) AS keep_id
      FROM verifications
      WHERE resultat = 'AUTHENTIQUE'
        AND plaque_id IS NOT NULL
        AND commission_montant > 0
      GROUP BY plaque_id
      HAVING COUNT(*) > 1
    ) d ON v.plaque_id = d.plaque_id
    SET v.commission_taux = 0, v.commission_montant = 0
    WHERE v.resultat = 'AUTHENTIQUE'
      AND v.paiement_commission_id IS NULL
      AND v.id <> d.keep_id
  `;
}

export async function createPaiementCommission(
  params: {
    type: TypeCommission;
    utilisateurId: number;
    periodeDebut: Date;
    periodeFin: Date;
    modePaiement: Prisma.PaiementCommissionCreateInput["modePaiement"];
    reference?: string | null;
    notes?: string | null;
    createurId: number;
  },
  tx: Tx
) {
  if (params.type === "VENTE") {
    const operations = await tx.$queryRaw<Array<{ id: number; commission_montant: number }>>`
      SELECT id, commission_montant
      FROM ventes
      WHERE vendeur_id = ${params.utilisateurId}
        AND canal = 'COMMERCIAL'
        AND paiement_commission_id IS NULL
        AND commission_montant > 0
        AND date_vente >= ${params.periodeDebut}
        AND date_vente <= ${params.periodeFin}
      FOR UPDATE
    `;
    if (operations.length === 0) {
      throw Object.assign(new Error("Aucune commission de vente à payer sur cette période"), { status: 409 });
    }
    const montant = operations.reduce((sum, o) => sum + o.commission_montant, 0);
    const numero = await generateDocumentNumber("COM", tx);
    const paiement = await tx.paiementCommission.create({
      data: {
        numero,
        type: "VENTE",
        utilisateurId: params.utilisateurId,
        periodeDebut: params.periodeDebut,
        periodeFin: params.periodeFin,
        montant,
        nombreOperations: operations.length,
        modePaiement: params.modePaiement,
        reference: params.reference || null,
        notes: params.notes || null,
        createurId: params.createurId,
      },
    });
    const marked = await tx.vente.updateMany({
      where: {
        id: { in: operations.map((o) => o.id) },
        paiementCommissionId: null,
      },
      data: { paiementCommissionId: paiement.id },
    });
    if (paiementMarquageConflit(marked.count, operations.length)) {
      throw Object.assign(new Error("Ces commissions viennent d'être payées. Rechargez la page."), { status: 409 });
    }
    return paiement;
  }

  await normaliserCommissionsControle(tx);

  const operations = await tx.$queryRaw<Array<{ id: number; commission_montant: number }>>`
    SELECT id, commission_montant
    FROM verifications
    WHERE agent_id = ${params.utilisateurId}
      AND resultat = 'AUTHENTIQUE'
      AND paiement_commission_id IS NULL
      AND commission_montant > 0
      AND horodatage >= ${params.periodeDebut}
      AND horodatage <= ${params.periodeFin}
    FOR UPDATE
  `;
  if (operations.length === 0) {
    throw Object.assign(new Error("Aucune commission de contrôle à payer sur cette période"), { status: 409 });
  }
  const montant = operations.reduce((sum, o) => sum + o.commission_montant, 0);
  const numero = await generateDocumentNumber("COM", tx);
  const paiement = await tx.paiementCommission.create({
    data: {
      numero,
      type: "CONTROLE",
      utilisateurId: params.utilisateurId,
      periodeDebut: params.periodeDebut,
      periodeFin: params.periodeFin,
      montant,
      nombreOperations: operations.length,
      modePaiement: params.modePaiement,
      reference: params.reference || null,
      notes: params.notes || null,
      createurId: params.createurId,
    },
  });
  const marked = await tx.verification.updateMany({
    where: {
      id: { in: operations.map((o) => o.id) },
      paiementCommissionId: null,
    },
    data: { paiementCommissionId: paiement.id },
  });
  if (paiementMarquageConflit(marked.count, operations.length)) {
    throw Object.assign(new Error("Ces commissions viennent d'être payées. Rechargez la page."), { status: 409 });
  }
  return paiement;
}
