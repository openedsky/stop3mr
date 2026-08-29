import { Prisma, StatutFacture } from "@prisma/client";
import { nextDocumentCounter } from "./counters";

export async function generateDocumentNumber(
  type: "FAC" | "REC" | "COM",
  tx?: Prisma.TransactionClient
): Promise<string> {
  const annee = new Date().getFullYear();
  const num = await nextDocumentCounter(type, annee, tx);
  return `${type}-${annee}-${String(num).padStart(5, "0")}`;
}

export function computeFactureStatut(montantTtc: number, montantPaye: number): StatutFacture {
  if (montantPaye <= 0) return "EMISE";
  if (montantPaye >= montantTtc) return "PAYEE";
  return "PARTIELLEMENT_PAYEE";
}

export const FACTURE_STATUT_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  EMISE: "Emise",
  PARTIELLEMENT_PAYEE: "Partiellement payée",
  PAYEE: "Payée",
  ANNULEE: "Annulée",
};

export const MODE_PAIEMENT_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  VIREMENT: "Virement",
  CHEQUE: "Chèque",
  MOBILE_MONEY: "Mobile Money",
  AUTRE: "Autre",
};

import { formatFcfa as formatMoney } from "./money";

export function formatFcfa(amount: number): string {
  return formatMoney(amount);
}

export async function creerFacturePourVente(
  tx: Prisma.TransactionClient,
  params: {
    clientId: number;
    venteId: number;
    montantHt: number;
    createurId: number | null;
    description: string;
    encaisse?: boolean;
    modePaiement?: Prisma.RecuPaiementCreateInput["modePaiement"];
  }
) {
  const numero = await generateDocumentNumber("FAC", tx);
  const montant = Math.max(0, params.montantHt);
  const encaisse = Boolean(params.encaisse) && montant > 0;
  const facture = await tx.facture.create({
    data: {
      numero,
      clientId: params.clientId,
      venteId: params.venteId,
      montantHt: montant,
      montantTtc: montant,
      montantPaye: encaisse ? montant : 0,
      tva: 0,
      statut: encaisse ? "PAYEE" : "EMISE",
      description: params.description,
      createurId: params.createurId,
    },
  });
  if (encaisse) {
    const recuNumero = await generateDocumentNumber("REC", tx);
    await tx.recuPaiement.create({
      data: {
        numero: recuNumero,
        factureId: facture.id,
        clientId: params.clientId,
        montant,
        modePaiement: params.modePaiement ?? "ESPECES",
        createurId: params.createurId,
      },
    });
  }
  return facture;
}
