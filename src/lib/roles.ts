export const APP_ROLES = ["OPERATEUR", "ADMINISTRATEUR", "COMMERCIAL", "AGENT_CT"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  OPERATEUR: "Opérateur production",
  ADMINISTRATEUR: "Administrateur",
  COMMERCIAL: "Commercial / vendeur",
  AGENT_CT: "Agent contrôle technique",
};

export const ROLES = {
  ALL: APP_ROLES,
  ADMIN: ["ADMINISTRATEUR"] as AppRole[],
  PRODUCTION: ["OPERATEUR", "ADMINISTRATEUR"] as AppRole[],
  COMMERCIAL: ["COMMERCIAL", "ADMINISTRATEUR"] as AppRole[],
  VENTES: ["COMMERCIAL", "ADMINISTRATEUR"] as AppRole[],
  CLIENTS: ["COMMERCIAL", "ADMINISTRATEUR"] as AppRole[],
  CRM: ["ADMINISTRATEUR"] as AppRole[],
  CT: ["AGENT_CT", "ADMINISTRATEUR"] as AppRole[],
  CATALOGUE: ["OPERATEUR", "ADMINISTRATEUR", "COMMERCIAL"] as AppRole[],
  RAPPORTS: ["COMMERCIAL", "AGENT_CT", "ADMINISTRATEUR"] as AppRole[],
  PERFORMANCES: ["COMMERCIAL", "AGENT_CT", "ADMINISTRATEUR"] as AppRole[],
  CARTE: ["ADMINISTRATEUR", "OPERATEUR"] as AppRole[],
  COMMISSIONS_CT: ["AGENT_CT", "ADMINISTRATEUR"] as AppRole[],
  PAIEMENTS_COMMISSIONS: ["ADMINISTRATEUR"] as AppRole[],
};

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

export function hasRole(role: string, allowed: readonly AppRole[]): boolean {
  return allowed.includes(role as AppRole);
}

export function homePathForRole(role: string): string {
  if (role === "AGENT_CT") return "/controle/verification";
  if (role === "COMMERCIAL") return "/ventes/nouvelle";
  return "/dashboard";
}

export function familleToTypeProduit(famille: string): "STOP" | "LIMITATION_VITESSE" {
  return famille === "LIMITATION" ? "LIMITATION_VITESSE" : "STOP";
}
