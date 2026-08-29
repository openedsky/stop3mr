import { Prisma } from "@prisma/client";
import { computeCommission } from "./money";

type Tx = Prisma.TransactionClient;

export type TarifFigé = {
  prixVente: number;
  commissionTaux: number;
  commissionMontant: number;
};

export function figerTarifVente(params: {
  prixCatalogue: number;
  prixReference: number;
  commissionTauxCatalogue: number;
  avecCommission: boolean;
}): TarifFigé {
  const prixVente = params.prixCatalogue > 0 ? params.prixCatalogue : params.prixReference;
  const commissionTaux = params.avecCommission ? params.commissionTauxCatalogue : 0;
  return {
    prixVente,
    commissionTaux,
    commissionMontant: params.avecCommission ? computeCommission(prixVente, commissionTaux) : 0,
  };
}

/** Met à jour le prix de référence des plaques non vendues uniquement. */
export async function synchroniserPrixStock(tx: Tx, produitId: number, prixHt: number) {
  await tx.plaque.updateMany({
    where: { produitId, statut: { in: ["EN_STOCK", "AFFECTEE"] } },
    data: { prixReference: prixHt },
  });
}
