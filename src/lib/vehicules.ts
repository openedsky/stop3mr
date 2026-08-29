import { Vehicule } from "@prisma/client";

export type VehiculePayload = {
  id?: number;
  immatriculation: string;
  marqueVehicule?: string | null;
  modeleVehicule?: string | null;
};

export function normalizeImmatriculation(immat: string): string {
  return immat.toUpperCase().replace(/\s/g, "");
}

export function mapVehiculeInput(data: VehiculePayload) {
  return {
    immatriculation: normalizeImmatriculation(data.immatriculation),
    marqueVehicule: data.marqueVehicule?.trim() || null,
    modeleVehicule: data.modeleVehicule?.trim() || null,
  };
}

export function formatVehiculeLabel(v: Pick<Vehicule, "immatriculation" | "marqueVehicule" | "modeleVehicule">): string {
  const parts = [v.immatriculation];
  if (v.marqueVehicule) parts.push(v.marqueVehicule);
  if (v.modeleVehicule) parts.push(v.modeleVehicule);
  return parts.join(" — ");
}

export function formatClientVehiculesSummary(vehicules: Pick<Vehicule, "immatriculation">[]): string {
  if (vehicules.length === 0) return "Aucun véhicule";
  if (vehicules.length === 1) return vehicules[0].immatriculation;
  return `${vehicules[0].immatriculation} (+${vehicules.length - 1})`;
}
