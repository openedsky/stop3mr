import { z } from "zod";
import { isValidCiImmatriculation, isValidCiPhone, isValidNcc } from "./clients";

export const vehiculeSchema = z.object({
  id: z.number().int().positive().optional(),
  immatriculation: z
    .string()
    .min(3)
    .max(20)
    .refine(isValidCiImmatriculation, "Format immatriculation CI invalide (ex: AB-123-CD)"),
  marqueVehicule: z.string().max(100).optional().or(z.literal("")),
  modeleVehicule: z.string().max(100).optional().or(z.literal("")),
});

export type VehiculeInput = z.infer<typeof vehiculeSchema>;

const clientBaseFields = {
  typeClient: z.enum(["PARTICULIER", "ENTREPRISE"]).default("PARTICULIER"),
  nom: z.string().min(2, "Nom requis").max(200),
  raisonSociale: z.string().max(200).optional().or(z.literal("")),
  telephone: z.string().min(8).max(20).refine(isValidCiPhone, "Téléphone ivoirien invalide (ex: 07 XX XX XX XX)"),
  email: z.string().email("E-mail invalide").max(255).optional().or(z.literal("")),
  ncc: z.string().max(50).optional().or(z.literal("")),
  rccm: z.string().max(50).optional().or(z.literal("")),
  adresse: z.string().max(300).optional().or(z.literal("")),
  commune: z.string().max(100).optional().or(z.literal("")),
  ville: z.string().max(100).optional().or(z.literal("")),
  pays: z.string().max(100).default("Côte d'Ivoire"),
  typePieceIdentite: z.enum(["CNI", "PASSEPORT", "CARTE_CONSULAIRE", "AUTRE"]).optional().nullable(),
  numeroPieceIdentite: z.string().max(50).optional().or(z.literal("")),
  fneStatut: z
    .enum(["NON_APPLICABLE", "EN_ATTENTE", "SOUMIS", "VALIDE", "REJETE"])
    .default("NON_APPLICABLE"),
  fneReference: z.string().max(100).optional().or(z.literal("")),
};

function refineClientData(data: {
  typeClient?: string;
  raisonSociale?: string;
  ncc?: string;
  fneStatut?: string;
  vehicules?: Array<{ immatriculation: string }>;
}, ctx: z.RefinementCtx) {
  if (data.typeClient === "ENTREPRISE") {
    if (!data.raisonSociale?.trim()) {
      ctx.addIssue({ code: "custom", message: "Raison sociale requise pour une entreprise", path: ["raisonSociale"] });
    }
    if (data.ncc && !isValidNcc(data.ncc)) {
      ctx.addIssue({ code: "custom", message: "Format NCC invalide", path: ["ncc"] });
    }
  }
  if (data.fneStatut !== "NON_APPLICABLE" && data.typeClient === "ENTREPRISE" && !data.ncc?.trim()) {
    ctx.addIssue({ code: "custom", message: "NCC requis pour la facturation FNE", path: ["ncc"] });
  }
  if (data.vehicules) {
    const immats = data.vehicules.map((v) => v.immatriculation.toUpperCase().replace(/\s/g, ""));
    if (new Set(immats).size !== immats.length) {
      ctx.addIssue({ code: "custom", message: "Immatriculations dupliquées dans la liste", path: ["vehicules"] });
    }
  }
}

export const clientSchema = z
  .object({
    ...clientBaseFields,
    vehicules: z.array(vehiculeSchema).min(1, "Au moins un véhicule requis"),
  })
  .superRefine(refineClientData);

export type ClientInput = z.infer<typeof clientSchema>;

/** Schéma enregistrement public : client + 1 véhicule pour la plaque */
export const registerSchema = z
  .object({
    ...clientBaseFields,
    immatriculation: vehiculeSchema.shape.immatriculation,
    marqueVehicule: vehiculeSchema.shape.marqueVehicule,
    modeleVehicule: vehiculeSchema.shape.modeleVehicule,
    token: z.string().min(32).max(64),
  })
  .superRefine(refineClientData);

export type RegisterInput = z.infer<typeof registerSchema>;
