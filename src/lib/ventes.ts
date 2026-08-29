export const CANAL_VENTE_LABELS: Record<string, string> = {
  COMMERCIAL: "Commercial vendeur",
  DIRECTE: "Vente directe",
};

export function isVenteDirecte(canal?: string | null) {
  return canal === "DIRECTE";
}
