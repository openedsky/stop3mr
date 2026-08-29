import { computeCommission } from "./money";

export function commissionControleAuthentique(params: {
  resultat: string;
  plaqueVendue: boolean;
  dejaCommissionnee: boolean;
  prixVente: number | null | undefined;
  taux: number;
}): { commissionTaux: number; commissionMontant: number } {
  if (
    params.resultat !== "AUTHENTIQUE" ||
    !params.plaqueVendue ||
    params.dejaCommissionnee ||
    !params.prixVente ||
    params.prixVente <= 0 ||
    params.taux <= 0
  ) {
    return { commissionTaux: 0, commissionMontant: 0 };
  }
  return {
    commissionTaux: params.taux,
    commissionMontant: computeCommission(params.prixVente, params.taux),
  };
}
