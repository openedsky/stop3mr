export type CanalVenteInterne = "COMMERCIAL" | "DIRECTE";

export type DecisionVente =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** Règles d’une vente interne (hors enregistrement public QR). */
export function autoriserVenteInterne(params: {
  role: string;
  canal: CanalVenteInterne;
  plaqueStatut: string;
  plaqueCommercialId: number | null;
  userId: number;
}): DecisionVente {
  if (params.plaqueStatut === "VENDUE") {
    return { ok: false, status: 409, error: "Cette plaque est déjà vendue" };
  }

  if (params.role === "COMMERCIAL") {
    if (params.plaqueStatut !== "AFFECTEE" || params.plaqueCommercialId !== params.userId) {
      return { ok: false, status: 403, error: "Cette plaque n'est pas dans votre stock vendeur" };
    }
    return { ok: true };
  }

  if (params.canal === "DIRECTE") {
    if (params.plaqueStatut !== "EN_STOCK") {
      return {
        ok: false,
        status: 409,
        error: "La vente directe n'est possible que depuis le stock production",
      };
    }
    return { ok: true };
  }

  if (params.plaqueStatut !== "AFFECTEE") {
    return {
      ok: false,
      status: 409,
      error: "Choisissez une plaque affectée à un commercial, ou passez en vente directe",
    };
  }
  return { ok: true };
}

export function paiementMarquageConflit(marques: number, attendues: number): boolean {
  return marques !== attendues;
}
