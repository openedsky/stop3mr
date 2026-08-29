export type ProduitSiteStats = {
  produitId: number | null;
  code: string;
  libelle: string;
  stock: number;
  vendus: number;
};

export type TypeSiteCarte = "production" | "controle";

export type CentreCarte = {
  id: number;
  kind: TypeSiteCarte;
  code: string;
  libelle: string;
  pays: string;
  ville: string | null;
  commune: string | null;
  quartier: string | null;
  adresse: string | null;
  latitude: number | null;
  longitude: number | null;
  georeference: boolean;
  adresseComplete: string;
  couvertVendeur: boolean;
  stats: {
    stockDisponible: number;
    ventes: number;
    verifications: number;
    authentiques: number;
    inconnues: number;
    contrefaites: number;
    agents: number;
    commerciaux: number;
    parProduit: ProduitSiteStats[];
  };
};

export function siteKey(kind: TypeSiteCarte, id: number) {
  return `${kind}:${id}`;
}

export function formatAdresseCentre(c: {
  adresse?: string | null;
  quartier?: string | null;
  commune?: string | null;
  ville?: string | null;
  pays?: string | null;
}): string {
  const parts = [c.adresse, c.quartier, c.commune, c.ville, c.pays].filter(Boolean) as string[];
  return parts.filter((p, i) => i === 0 || p.toLowerCase() !== parts[i - 1].toLowerCase()).join(", ");
}

export const CI_CENTER: [number, number] = [7.54, -5.55];
export const CI_DEFAULT_ZOOM = 7;
