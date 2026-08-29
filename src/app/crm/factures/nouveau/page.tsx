"use client";

import { FormEvent, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { ClientSelect } from "@/components/ClientSelect";
import { Req } from "@/components/Req";
import { formatFcfa } from "@/lib/money";
import { swalConfirm, swalError, swalSuccess } from "@/lib/swal";

function NouvelleFactureForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preClientId = searchParams.get("clientId");

  const [clientId, setClientId] = useState(preClientId ?? "");
  const [montantHt, setMontantHt] = useState("3000");
  const [tva, setTva] = useState("0");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ht = Number(montantHt) || 0;
  const tvaAmt = Number(tva) || 0;
  const ttc = ht + tvaAmt;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await swalConfirm("Émettre cette facture ?", "La facture sera créée au statut émise.", "Émettre");
    if (!ok) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/crm/factures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: Number(clientId),
        montantHt: ht,
        montantTtc: ttc,
        tva: tvaAmt,
        description,
        statut: "EMISE",
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      await swalError("Facture non enregistrée", d.error ?? "Erreur");
      setError(d.error ?? "Erreur");
      return;
    }
    await swalSuccess("Facture émise");
    router.push("/crm/factures");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <Link href="/crm/factures" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Factures
        </Link>
        <h1 className="mb-6 text-2xl font-bold">Nouvelle facture</h1>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Client<Req /></label>
            <ClientSelect value={clientId} onChange={setClientId} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Montant HT<Req /></label>
            <input className="input-field" type="number" value={montantHt} onChange={(e) => setMontantHt(e.target.value)} required min={1} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">TVA</label>
            <input className="input-field" type="number" value={tva} onChange={(e) => setTva(e.target.value)} min={0} />
          </div>
          <p className="text-sm font-semibold">Total TTC : {formatFcfa(ttc)}</p>
          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea className="input-field min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading || !clientId}>
            {loading ? "Création..." : "Émettre la facture"}
          </button>
        </form>
      </main>
    </div>
  );
}

export default function NouvelleFacturePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Chargement...</div>}>
      <NouvelleFactureForm />
    </Suspense>
  );
}
