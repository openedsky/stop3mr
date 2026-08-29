export const TYPES_RAPPORT = [
  "SITUATION_VENTE",
  "RUPTURE_STOCK",
  "ANOMALIE_CONTROLE",
  "CONTREFACON",
  "INCIDENT_SITE",
  "AUTRE",
] as const;

export type TypeRapport = (typeof TYPES_RAPPORT)[number];

export const TYPE_RAPPORT_LABELS: Record<TypeRapport, string> = {
  SITUATION_VENTE: "Situation de vente",
  RUPTURE_STOCK: "Rupture de stock",
  ANOMALIE_CONTROLE: "Anomalie de contrôle",
  CONTREFACON: "Contrefaçon suspectée",
  INCIDENT_SITE: "Incident sur site",
  AUTRE: "Autre situation",
};

export const TYPES_RAPPORT_VENDEUR: TypeRapport[] = ["SITUATION_VENTE", "RUPTURE_STOCK", "INCIDENT_SITE", "AUTRE"];
export const TYPES_RAPPORT_AGENT: TypeRapport[] = ["ANOMALIE_CONTROLE", "CONTREFACON", "INCIDENT_SITE", "AUTRE"];

export const STATUT_RAPPORT_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  SOUMIS: "Soumis",
  LU: "Lu",
};

export function typesRapportPourRole(role: string): TypeRapport[] {
  if (role === "ADMINISTRATEUR") return [...TYPES_RAPPORT];
  if (role === "COMMERCIAL") return TYPES_RAPPORT_VENDEUR;
  if (role === "AGENT_CT") return TYPES_RAPPORT_AGENT;
  return [];
}
