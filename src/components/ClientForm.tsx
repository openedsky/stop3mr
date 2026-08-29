"use client";

import { FormEvent, useState } from "react";
import {
  TYPE_CLIENT_LABELS,
  TYPE_PIECE_LABELS,
  FNE_STATUT_LABELS,
  ClientPayload,
} from "@/lib/clients";
import { VehiculePayload } from "@/lib/vehicules";
import { swalConfirm, swalError } from "@/lib/swal";
import { Req } from "@/components/Req";

export type ClientFormData = ClientPayload & {
  vehicules: VehiculePayload[];
};

type Props = {
  initial?: Partial<ClientFormData> & {
    vehicules?: VehiculePayload[];
  };
  onSubmit: (data: ClientFormData) => Promise<void>;
  submitLabel?: string;
  loading?: boolean;
  showFne?: boolean;
  /** Formulaire public : un seul véhicule, champs plats */
  singleVehicle?: boolean;
};

const emptyVehicule = (): VehiculePayload => ({
  immatriculation: "",
  marqueVehicule: "",
  modeleVehicule: "",
});

export function ClientForm({
  initial,
  onSubmit,
  submitLabel = "Enregistrer",
  loading = false,
  showFne = true,
  singleVehicle = false,
}: Props) {
  const [typeClient, setTypeClient] = useState<"PARTICULIER" | "ENTREPRISE">(
    initial?.typeClient ?? "PARTICULIER"
  );
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [raisonSociale, setRaisonSociale] = useState(initial?.raisonSociale ?? "");
  const [telephone, setTelephone] = useState(initial?.telephone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [ncc, setNcc] = useState(initial?.ncc ?? "");
  const [rccm, setRccm] = useState(initial?.rccm ?? "");
  const [adresse, setAdresse] = useState(initial?.adresse ?? "");
  const [commune, setCommune] = useState(initial?.commune ?? "");
  const [ville, setVille] = useState(initial?.ville ?? "Abidjan");
  const [pays] = useState(initial?.pays ?? "Côte d'Ivoire");
  const [typePieceIdentite, setTypePieceIdentite] = useState<
    "CNI" | "PASSEPORT" | "CARTE_CONSULAIRE" | "AUTRE"
  >((initial?.typePieceIdentite as "CNI" | "PASSEPORT" | "CARTE_CONSULAIRE" | "AUTRE") ?? "CNI");
  const [numeroPieceIdentite, setNumeroPieceIdentite] = useState(initial?.numeroPieceIdentite ?? "");
  const [fneStatut, setFneStatut] = useState<
    "NON_APPLICABLE" | "EN_ATTENTE" | "SOUMIS" | "VALIDE" | "REJETE"
  >((initial?.fneStatut as "NON_APPLICABLE" | "EN_ATTENTE" | "SOUMIS" | "VALIDE" | "REJETE") ?? "NON_APPLICABLE");
  const [fneReference, setFneReference] = useState(initial?.fneReference ?? "");
  const [vehicules, setVehicules] = useState<VehiculePayload[]>(
    initial?.vehicules?.length ? initial.vehicules : [emptyVehicule()]
  );
  const [error, setError] = useState("");

  function updateVehicule(index: number, field: keyof VehiculePayload, value: string) {
    setVehicules((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  }

  function addVehicule() {
    setVehicules((prev) => [...prev, emptyVehicule()]);
  }

  function removeVehicule(index: number) {
    if (vehicules.length <= 1) return;
    setVehicules((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await swalConfirm("Enregistrer ce client ?", nom || raisonSociale || "Fiche client", "Enregistrer");
    if (!ok) return;
    setError("");
    try {
      await onSubmit({
        typeClient,
        nom,
        raisonSociale: raisonSociale || null,
        telephone,
        email: email || null,
        ncc: ncc || null,
        rccm: rccm || null,
        adresse: adresse || null,
        commune: commune || null,
        ville: ville || null,
        pays,
        typePieceIdentite,
        numeroPieceIdentite: numeroPieceIdentite || null,
        fneStatut,
        fneReference: fneReference || null,
        vehicules: vehicules.map((v) => ({
          id: v.id,
          immatriculation: v.immatriculation,
          marqueVehicule: v.marqueVehicule || null,
          modeleVehicule: v.modeleVehicule || null,
        })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur";
      await swalError("Client non enregistré", message);
      setError(message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Type de client<Req /></label>
        <select className="input-field" value={typeClient} onChange={(e) => setTypeClient(e.target.value as "PARTICULIER" | "ENTREPRISE")}>
          {Object.entries(TYPE_CLIENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {typeClient === "ENTREPRISE" && (
        <div>
          <label className="mb-1 block text-sm font-medium">Raison sociale<Req /></label>
          <input className="input-field" value={raisonSociale} onChange={(e) => setRaisonSociale(e.target.value)} required />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">
          {typeClient === "ENTREPRISE" ? <>Nom du responsable<Req /></> : <>Nom complet<Req /></>}
        </label>
        <input className="input-field" value={nom} onChange={(e) => setNom(e.target.value)} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Téléphone<Req /></label>
          <input className="input-field" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="07 XX XX XX XX" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">E-mail</label>
          <input className="input-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      {typeClient === "ENTREPRISE" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">NCC (Compte contribuable)</label>
            <input className="input-field uppercase" value={ncc} onChange={(e) => setNcc(e.target.value.toUpperCase())} placeholder="Requis pour FNE" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">RCCM</label>
            <input className="input-field" value={rccm} onChange={(e) => setRccm(e.target.value)} />
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Adresse</label>
        <input className="input-field" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Quartier, rue..." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Commune</label>
          <input className="input-field" value={commune} onChange={(e) => setCommune(e.target.value)} placeholder="Cocody, Yopougon..." />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Ville</label>
          <input className="input-field" value={ville} onChange={(e) => setVille(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Pièce d&apos;identité</label>
          <select className="input-field" value={typePieceIdentite} onChange={(e) => setTypePieceIdentite(e.target.value as typeof typePieceIdentite)}>
            {Object.entries(TYPE_PIECE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">N° pièce d&apos;identité</label>
          <input className="input-field" value={numeroPieceIdentite} onChange={(e) => setNumeroPieceIdentite(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">
            {singleVehicle ? "Véhicule concerné" : "Véhicules"}
          </p>
          {!singleVehicle && (
            <button type="button" onClick={addVehicule} className="text-xs font-medium text-red-600 hover:underline">
              + Ajouter un véhicule
            </button>
          )}
        </div>
        <div className="space-y-4">
          {vehicules.map((v, index) => (
            <div key={v.id ?? index} className="rounded-lg border border-slate-200 bg-white p-3">
              {!singleVehicle && vehicules.length > 1 && (
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Véhicule {index + 1}</span>
                  <button type="button" onClick={() => removeVehicule(index)} className="text-xs text-red-600 hover:underline">
                    Retirer
                  </button>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">Immatriculation<Req /></label>
                  <input
                    className="input-field uppercase"
                    value={v.immatriculation}
                    onChange={(e) => updateVehicule(index, "immatriculation", e.target.value.toUpperCase())}
                    required
                    placeholder="AB-123-CD"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Marque</label>
                  <input
                    className="input-field"
                    value={v.marqueVehicule ?? ""}
                    onChange={(e) => updateVehicule(index, "marqueVehicule", e.target.value)}
                    placeholder="Toyota"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Modèle</label>
                  <input
                    className="input-field"
                    value={v.modeleVehicule ?? ""}
                    onChange={(e) => updateVehicule(index, "modeleVehicule", e.target.value)}
                    placeholder="Corolla"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showFne && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="mb-2 text-sm font-semibold text-blue-900">Facturation FNE (DGI)</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Statut FNE</label>
              <select className="input-field" value={fneStatut} onChange={(e) => setFneStatut(e.target.value as typeof fneStatut)}>
                {Object.entries(FNE_STATUT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Référence FNE</label>
              <input className="input-field" value={fneReference} onChange={(e) => setFneReference(e.target.value)} placeholder="Réf. facture normalisée" />
            </div>
          </div>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Enregistrement..." : submitLabel}
      </button>
    </form>
  );
}
