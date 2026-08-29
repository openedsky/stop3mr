"use client";

import { FormEvent, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ValiditeBadge } from "@/components/ValiditeBadge";
import { formatFcfa } from "@/lib/money";
import { swalConfirm, swalError, swalSuccess } from "@/lib/swal";
import { StatutValidite } from "@/lib/validite";

type PlaqueInfo = {
  numeroSerie: string;
  typeProduit: string;
  statut: string;
  siteProduction: string;
  dateFabrication: string;
  vitesseLimitation: number | null;
  produit: { libelle: string; code: string; dimensions: string } | null;
  commercial: { identifiant: string; nom: string | null } | null;
  immatriculation: string | null;
  dateAchat: string | null;
};

type Lookup = {
  found: boolean;
  resultatSuggere: "AUTHENTIQUE" | "INCONNUE" | "CONTREFAITE";
  plaque: PlaqueInfo | null;
  validite: {
    statut: StatutValidite;
    dateAchat: string | null;
    dateExpiration: string | null;
    joursRestants: number | null;
  } | null;
};

type Verification = {
  id: number;
  numeroSaisi: string;
  resultat: string;
  horodatage: string;
  notes: string | null;
  immatriculationObservee: string | null;
  commissionMontant?: number;
};

const RESULT_LABEL: Record<string, string> = {
  AUTHENTIQUE: "Authentique",
  INCONNUE: "Inconnue / non référencée",
  CONTREFAITE: "Contrefaçon suspectée",
};

export default function VerificationPage() {
  const [numero, setNumero] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [resultat, setResultat] = useState<"AUTHENTIQUE" | "INCONNUE" | "CONTREFAITE">("AUTHENTIQUE");
  const [notes, setNotes] = useState("");
  const [immat, setImmat] = useState("");
  const [recent, setRecent] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/controle/verifications?limit=8")
      .then((r) => r.json())
      .then((d) => setRecent(d.verifications ?? []));
  }, []);

  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    const res = await fetch(`/api/controle/verifications?numero=${encodeURIComponent(numero.trim())}`);
    const data = await res.json();
    setLoading(false);
    setLookup(data);
    setResultat(data.resultatSuggere);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const ok = await swalConfirm("Enregistrer cette vérification ?", "Le résultat sera conservé dans l'historique.", "Enregistrer");
    if (!ok) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/controle/verifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numeroSaisi: numero.trim(),
        resultat,
        notes,
        immatriculationObservee: immat || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      await swalError("Vérification non enregistrée", data.error ?? "Erreur");
      setError(data.error ?? "Erreur");
      return;
    }
    const comm = data.verification?.commissionMontant
      ? ` — commission ${formatFcfa(data.verification.commissionMontant)}`
      : "";
    setSuccess(`Vérification enregistrée — ${RESULT_LABEL[resultat]}${comm}`);
    await swalSuccess("Vérification enregistrée", `${RESULT_LABEL[resultat]}${comm}`);
    setNotes("");
    setImmat("");
    fetch("/api/controle/verifications?limit=8")
      .then((r) => r.json())
      .then((d) => setRecent(d.verifications ?? []));
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold">Vérification d&apos;authenticité</h1>
        <p className="mb-8 text-slate-500">
          Contrôle en centre technique : saisissez le numéro de série. Une seule commission est due
          pour le premier contrôle authentique d&apos;une plaque déjà vendue. La validité est celle
          figée à l&apos;achat.
        </p>

        <form onSubmit={handleLookup} className="card mb-6 flex gap-2">
          <input
            className="input-field font-mono"
            placeholder="Numéro de série (ex. R3M-PR-260825-000001)"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary shrink-0" disabled={loading}>
            {loading ? "Recherche..." : "Vérifier"}
          </button>
        </form>

        {lookup && (
          <div className={`card mb-6 ${lookup.found ? "border-green-200" : "border-amber-200 bg-amber-50"}`}>
            {lookup.found && lookup.plaque ? (
              <>
                <p className="mb-3 font-semibold text-green-800">Produit authentique Stop 3MR</p>
                {lookup.validite && lookup.validite.statut !== "NON_VENDUE" && (
                  <div
                    className={`mb-4 rounded-lg px-3 py-2 text-sm ${
                      lookup.validite.statut === "EXPIREE"
                        ? "bg-red-50 text-red-800"
                        : lookup.validite.statut === "EXPIRE_BIENTOT"
                          ? "bg-amber-50 text-amber-900"
                          : "bg-green-50 text-green-800"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <ValiditeBadge
                        statut={lookup.validite.statut}
                        joursRestants={lookup.validite.joursRestants}
                      />
                    </div>
                    {lookup.validite.statut === "EXPIREE" && (
                      <p className="font-medium">Cette plaque a dépassé sa période de validité de deux ans. Signalez-le au propriétaire.</p>
                    )}
                    {lookup.validite.statut === "EXPIRE_BIENTOT" && (
                      <p>
                        Expiration le{" "}
                        {lookup.validite.dateExpiration
                          ? new Date(lookup.validite.dateExpiration).toLocaleDateString("fr-FR")
                          : "—"}
                        .
                      </p>
                    )}
                    {lookup.validite.dateExpiration && lookup.validite.statut === "VALIDE" && (
                      <p>
                        Valide jusqu&apos;au {new Date(lookup.validite.dateExpiration).toLocaleDateString("fr-FR")}.
                      </p>
                    )}
                  </div>
                )}
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-400">Série</dt>
                    <dd className="font-mono">{lookup.plaque.numeroSerie}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Produit</dt>
                    <dd>{lookup.plaque.produit?.libelle ?? lookup.plaque.typeProduit}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Site de production</dt>
                    <dd>{lookup.plaque.siteProduction}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Statut</dt>
                    <dd>{lookup.plaque.statut.replace("_", " ")}</dd>
                  </div>
                  {lookup.plaque.vitesseLimitation && (
                    <div>
                      <dt className="text-slate-400">Vitesse</dt>
                      <dd>{lookup.plaque.vitesseLimitation} km/h</dd>
                    </div>
                  )}
                </dl>
              </>
            ) : (
              <p className="font-medium text-amber-900">
                Aucune plaque avec ce numéro n&apos;est référencée. Traitez comme inconnue ou contrefaçon.
              </p>
            )}

            <form onSubmit={handleSave} className="mt-6 space-y-3 border-t border-slate-100 pt-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Résultat à enregistrer</label>
                <select
                  className="input-field"
                  value={resultat}
                  onChange={(e) => setResultat(e.target.value as typeof resultat)}
                >
                  <option value="AUTHENTIQUE">Authentique</option>
                  <option value="INCONNUE">Inconnue / non référencée</option>
                  <option value="CONTREFAITE">Contrefaçon suspectée</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Immatriculation observée (optionnel)</label>
                <input className="input-field" value={immat} onChange={(e) => setImmat(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-700">{success}</p>}
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Enregistrement..." : "Enregistrer dans l'historique"}
              </button>
            </form>
          </div>
        )}

        <div className="card">
          <h2 className="mb-4 font-semibold">Dernières vérifications</h2>
          <div className="space-y-2">
            {recent.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 px-3 py-2 text-sm">
                <span className="font-mono text-xs">{v.numeroSaisi}</span>
                <span className={`badge ${v.resultat === "AUTHENTIQUE" ? "badge-success" : v.resultat === "CONTREFAITE" ? "badge-warning" : "badge-info"}`}>
                  {RESULT_LABEL[v.resultat] ?? v.resultat}
                </span>
                <span className="text-xs text-slate-400">{new Date(v.horodatage).toLocaleString("fr-FR")}</span>
              </div>
            ))}
            {recent.length === 0 && <p className="text-sm text-slate-400">Aucune vérification pour le moment.</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
