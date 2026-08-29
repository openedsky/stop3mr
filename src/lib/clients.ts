import { createHmac } from "crypto";
import { Client, TypeClient, TypePieceIdentite, FneStatut } from "@prisma/client";
import { decrypt, encrypt, requireEncryptionKey } from "./encryption";
import { VehiculePayload } from "./vehicules";

export type ClientPayload = {
  typeClient?: TypeClient;
  nom: string;
  raisonSociale?: string | null;
  telephone: string;
  email?: string | null;
  ncc?: string | null;
  rccm?: string | null;
  adresse?: string | null;
  commune?: string | null;
  ville?: string | null;
  pays?: string;
  typePieceIdentite?: TypePieceIdentite | null;
  numeroPieceIdentite?: string | null;
  fneStatut?: FneStatut;
  fneReference?: string | null;
  vehicules?: VehiculePayload[];
};

const ENCRYPTED_FIELDS = ["nom", "telephone", "email", "raisonSociale", "adresse", "numeroPieceIdentite"] as const;

export function searchHash(value: string): string {
  return createHmac("sha256", requireEncryptionKey()).update(value).digest("hex");
}

export function clientSearchHashes(nom: string, telephone: string) {
  const nomNorm = normalizePersonName(nom);
  const telNorm = normalizePhoneDigits(telephone);
  return {
    nomHash: nomNorm ? searchHash(nomNorm) : null,
    telephoneHash: telNorm ? searchHash(telNorm) : null,
    nomPrefixHash: nomNorm.length >= 3 ? searchHash(nomNorm.slice(0, 3)) : null,
  };
}

export function encryptClientData(data: Omit<ClientPayload, "vehicules">) {
  return {
    typeClient: data.typeClient ?? "PARTICULIER",
    nom: encrypt(data.nom),
    raisonSociale: data.raisonSociale ? encrypt(data.raisonSociale) : null,
    telephone: encrypt(data.telephone),
    email: data.email ? encrypt(data.email) : null,
    ncc: data.ncc?.trim() || null,
    rccm: data.rccm?.trim() || null,
    adresse: data.adresse ? encrypt(data.adresse) : null,
    commune: data.commune?.trim() || null,
    ville: data.ville?.trim() || null,
    pays: data.pays ?? "Côte d'Ivoire",
    typePieceIdentite: data.typePieceIdentite ?? null,
    numeroPieceIdentite: data.numeroPieceIdentite ? encrypt(data.numeroPieceIdentite) : null,
    fneStatut: data.fneStatut ?? "NON_APPLICABLE",
    fneReference: data.fneReference?.trim() || null,
    ...clientSearchHashes(data.nom, data.telephone),
  };
}

export function decryptClientRecord<T extends Client>(client: T) {
  const decrypted: Record<string, unknown> = { ...client };
  for (const field of ENCRYPTED_FIELDS) {
    const val = client[field as keyof Client];
    if (typeof val === "string" && val) {
      try {
        decrypted[field] = decrypt(val);
      } catch {
        decrypted[field] = "";
      }
    }
  }
  return decrypted as T & {
    nom: string;
    telephone: string;
    email: string | null;
    raisonSociale: string | null;
    adresse: string | null;
    numeroPieceIdentite: string | null;
  };
}

export const TYPE_CLIENT_LABELS: Record<string, string> = {
  PARTICULIER: "Personne physique",
  ENTREPRISE: "Organisation / personne morale",
};

export const TYPE_PIECE_LABELS: Record<string, string> = {
  CNI: "CNI",
  PASSEPORT: "Passeport",
  CARTE_CONSULAIRE: "Carte consulaire",
  AUTRE: "Autre",
};

export const FNE_STATUT_LABELS: Record<string, string> = {
  NON_APPLICABLE: "Non applicable",
  EN_ATTENTE: "En attente FNE",
  SOUMIS: "Soumis DGI",
  VALIDE: "Validé FNE",
  REJETE: "Rejeté",
};

export const AUDIT_LABELS: Record<string, string> = {
  CONNEXION: "Connexion",
  CONNEXION_ECHOUEE: "Connexion échouée",
  DECONNEXION: "Déconnexion",
  PLAQUE_CREEE: "Plaque créée",
  VENTE_ENREGISTREE: "Vente enregistrée",
  CLIENT_CREE: "Client créé",
  CLIENT_MODIFIE: "Client modifié",
  CLIENT_SUPPRIME: "Client supprimé",
  VEHICULE_AJOUTE: "Véhicule ajouté",
  PROFIL_MODIFIE: "Profil modifié",
  MOT_DE_PASSE_MODIFIE: "Mot de passe modifié",
  EXPORT_DONNEES: "Export de données",
  FACTURE_CREEE: "Facture créée",
  FACTURE_MODIFIEE: "Facture modifiée",
  RECU_CREE: "Reçu de paiement créé",
  PARAMETRES_MODIFIES: "Paramètres QR modifiés",
  PARAMETRES_METIER: "Paramètres métier / commissions",
  SITE_PRODUCTION_CREE: "Site de production créé",
  PRODUIT_CREE: "Produit catalogue créé",
  PRODUIT_MODIFIE: "Produit catalogue modifié",
  COMMISSION_PAYEE: "Commission payée",
  UTILISATEUR_CREE: "Utilisateur créé",
  UTILISATEUR_MODIFIE: "Utilisateur modifié",
  CENTRE_CT_CREE: "Centre de contrôle créé",
  CENTRE_CT_MODIFIE: "Centre de contrôle modifié",
  STOCK_AFFECTE: "Stock mis à disposition d'un commercial",
  VERIFICATION_CT: "Vérification contrôle technique",
};

export function getAuditLabel(action: string): string {
  return AUDIT_LABELS[action] ?? action;
}

/** Validation téléphone CI : 10 chiffres, préfixe 01/05/07/21/25/27 */
export function isValidCiPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  return /^(225)?(01|05|07|21|25|27)\d{8}$/.test(cleaned) || /^0(1|5|7|21|25|27)\d{8}$/.test(cleaned);
}

/** Format immatriculation CI : AA-123-AB ou 1234 AB 01 */
export function isValidCiImmatriculation(immat: string): boolean {
  const u = immat.toUpperCase().replace(/\s/g, "");
  return /^[A-Z]{2}-\d{3,4}-[A-Z]{2}$/.test(u) || /^\d{4}[A-Z]{2}\d{2}$/.test(u);
}

/** NCC ivoirien : format simplifié */
export function isValidNcc(ncc: string): boolean {
  return /^[A-Z0-9\-]{5,20}$/i.test(ncc.trim());
}

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^225/, "");
}

export function normalizePersonName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function sameClientIdentity(
  stored: { nom: string; telephone: string },
  submitted: { nom: string; telephone: string }
): boolean {
  return (
    normalizePersonName(stored.nom) === normalizePersonName(submitted.nom) &&
    normalizePhoneDigits(stored.telephone) === normalizePhoneDigits(submitted.telephone)
  );
}
