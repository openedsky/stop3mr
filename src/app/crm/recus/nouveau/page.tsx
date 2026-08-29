"use client";

import { FormEvent, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { formatFcfa } from "@/lib/crm";
import { swalConfirm, swalError, swalSuccess } from "@/lib/swal";
import { Req } from "@/components/Req";

type FactureOption = {
  id: number;
  numero: string;
  montantTtc: number;
  montantPaye: number;
  solde: number;
  client: { nom: string };
};

function NouveauRecuForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preFactureId = searchParams.get("factureId");

  const [factures, setFactures] = useState<FactureOption[]>([]);
  const [factureId, setFactureId] = useState(preFactureId ?? "");
  const [montant, setMontant] = useState("");
  const [modePaiement, setModePaiement] = useState("ESPECES");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/crm/factures?impayees=true")
      .then((r) => r.json())
      .then((d) => setFactures(d.factures));
  }, []);

  const selected = factures.find((f) => String(f.id) === factureId);

  useEffect(() => {
    if (selected && !montant) setMontant(String(selected.solde));
  }, [selected, montant]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await swalConfirm("Enregistrer ce reçu ?", `${montant} ${modePaiement}`, "Enregistrer");
    if (!ok) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/crm/recus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        factureId: Number(factureId),
        montant: Number(montant),
        modePaiement,
        reference: reference || undefined,
        notes: notes || undefined,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      await swalError("Reçu non enregistré", d.error ?? "Erreur");
      setError(d.error ?? "Erreur");
      return;
    }
    await swalSuccess("Reçu enregistré");
    router.push("/crm/recus");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <Link href="/crm/recus" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Reçus
        </Link>
        <h1 className="mb-6 text-2xl font-bold">Nouveau reçu de paiement</h1>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Facture<Req /></label>
            <select className="input-field" value={factureId} onChange={(e) => setFactureId(e.target.value)} required>
              <option value="">— Choisir une facture impayée —</option>
              {factures.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.numero} — {f.client.nom} — solde {formatFcfa(f.solde)}
                </option>
              ))}
            </select>
          </div>
          {selected && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Solde restant : <strong>{formatFcfa(selected.solde)}</strong>
            </p>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">Montant encaissé<Req /></label>
            <input className="input-field" type="number" value={montant} onChange={(e) => setMontant(e.target.value)} required min={1} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Mode de paiement<Req /></label>
            <select className="input-field" value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}>
              <option value="ESPECES">Espèces</option>
              <option value="VIREMENT">Virement</option>
              <option value="CHEQUE">Chèque</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="AUTRE">Autre</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Référence</label>
            <input className="input-field" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° chèque, transaction..." />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Notes</label>
            <textarea className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading || !factureId}>
            {loading ? "Enregistrement..." : "Émettre le reçu"}
          </button>
        </form>
      </main>
    </div>
  );
}

export default function NouveauRecuPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Chargement...</div>}>
      <NouveauRecuForm />
    </Suspense>
  );
}
