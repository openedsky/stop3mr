"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { FilterField, PaginationBar } from "@/components/PaginationBar";
import { formatFcfa, formatNombre } from "@/lib/money";
import { MODE_PAIEMENT_LABELS } from "@/lib/crm";
import { swalConfirm, swalError, swalSuccess } from "@/lib/swal";

type APayer = {
  type: "VENTE" | "CONTROLE";
  utilisateurId: number;
  nom: string;
  identifiant: string;
  operations: number;
  montant: number;
};

type Paiement = {
  id: number;
  numero: string;
  type: "VENTE" | "CONTROLE";
  montant: number;
  nombreOperations: number;
  modePaiement: string;
  reference: string | null;
  datePaiement: string;
  beneficiaire: string;
  utilisateur: { identifiant: string };
  createur: { identifiant: string } | null;
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function PaiementsCommissionsPage() {
  const [mois, setMois] = useState(currentMonth());
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [aPayer, setAPayer] = useState<APayer[]>([]);
  const [historique, setHistorique] = useState<Paiement[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [totaux, setTotaux] = useState({
    aPayer: 0,
    ventesDue: 0,
    controlesDue: 0,
    ventesPayees: 0,
    controlesPayees: 0,
  });
  const [payingKey, setPayingKey] = useState<string | null>(null);
  const [modePaiement, setModePaiement] = useState<"ESPECES" | "VIREMENT" | "CHEQUE" | "MOBILE_MONEY" | "AUTRE">(
    "MOBILE_MONEY"
  );
  const [reference, setReference] = useState("");

  function load(p = page) {
    setLoading(true);
    const params = new URLSearchParams({ mois, page: String(p), limit: "15" });
    if (type) params.set("type", type);
    fetch(`/api/commissions/paiements?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setAPayer(d.aPayer ?? []);
        setHistorique(d.historique ?? []);
        setTotaux(
          d.totaux ?? {
            aPayer: 0,
            ventesDue: 0,
            controlesDue: 0,
            ventesPayees: 0,
            controlesPayees: 0,
          }
        );
        setPages(d.pagination?.pages ?? 1);
        setTotal(d.pagination?.total ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function payer(row: APayer) {
    const ok = await swalConfirm(
      "Payer cette commission ?",
      `${row.nom} — ${formatFcfa(row.montant)} pour ${row.operations} opération(s). Les compteurs impayés seront remis à zéro.`,
      "Payer et clôturer"
    );
    if (!ok) return;
    const key = `${row.type}-${row.utilisateurId}`;
    setPayingKey(key);
    const res = await fetch("/api/commissions/paiements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: row.type,
        utilisateurId: row.utilisateurId,
        mois,
        modePaiement,
        reference: reference || undefined,
      }),
    });
    const data = await res.json();
    setPayingKey(null);
    if (!res.ok) {
      await swalError("Paiement impossible", data.error ?? "Erreur");
      return;
    }
    await swalSuccess("Commission payée", `${data.paiement.numero} — ${formatFcfa(data.paiement.montant)}`);
    load(page);
  }

  function handleFilter(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    load(1);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link href="/admin" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Administration
        </Link>
        <h1 className="mb-2 text-2xl font-bold">Paiement des commissions</h1>
        <p className="mb-6 text-slate-500">
          Clôture mensuelle : le paiement retrace le versement et remet les compteurs impayés à zéro pour la période.
        </p>

        <form onSubmit={handleFilter} className="card mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <FilterField label="Mois">
              <input className="input-field" type="month" value={mois} onChange={(e) => setMois(e.target.value)} />
            </FilterField>
            <FilterField label="Type">
              <select className="input-field" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Tous</option>
                <option value="VENTE">Commerciaux</option>
                <option value="CONTROLE">Contrôleurs</option>
              </select>
            </FilterField>
            <FilterField label="Mode de paiement">
              <select
                className="input-field"
                value={modePaiement}
                onChange={(e) => setModePaiement(e.target.value as typeof modePaiement)}
              >
                {Object.entries(MODE_PAIEMENT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Référence">
              <input
                className="input-field"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="N° virement, OM…"
              />
            </FilterField>
            <button type="submit" className="btn-secondary">
              Afficher
            </button>
          </div>
        </form>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <p className="text-sm text-slate-500">À payer ce mois</p>
            <p className="text-2xl font-bold text-amber-700">{formatFcfa(totaux.aPayer)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Commerciaux dus</p>
            <p className="text-2xl font-bold">{formatFcfa(totaux.ventesDue)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Contrôleurs dus</p>
            <p className="text-2xl font-bold">{formatFcfa(totaux.controlesDue)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Déjà versé</p>
            <p className="text-2xl font-bold text-green-700">
              {formatFcfa(totaux.ventesPayees + totaux.controlesPayees)}
            </p>
          </div>
        </div>

        <div className="card mb-8 overflow-x-auto">
          <h2 className="mb-4 text-lg font-semibold">Compteurs à clôturer</h2>
          {loading ? (
            <p className="text-slate-400">Chargement...</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-3 pr-4 font-medium">Bénéficiaire</th>
                  <th className="pb-3 pr-4 font-medium">Type</th>
                  <th className="pb-3 pr-4 font-medium">Opérations</th>
                  <th className="pb-3 pr-4 font-medium">Montant</th>
                  <th className="pb-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {aPayer.map((row) => {
                  const key = `${row.type}-${row.utilisateurId}`;
                  return (
                    <tr key={key} className="border-b border-slate-100">
                      <td className="py-3 pr-4">
                        <p className="font-medium">{row.nom}</p>
                        <p className="font-mono text-[11px] text-slate-400">{row.identifiant}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`badge ${row.type === "VENTE" ? "badge-info" : "badge-success"}`}>
                          {row.type === "VENTE" ? "Commercial" : "Contrôleur"}
                        </span>
                      </td>
                      <td className="py-3 pr-4">{formatNombre(row.operations)}</td>
                      <td className="py-3 pr-4 font-semibold text-green-700">{formatFcfa(row.montant)}</td>
                      <td className="py-3">
                        <button
                          type="button"
                          className="btn-primary !py-1.5 !text-xs"
                          disabled={payingKey === key}
                          onClick={() => payer(row)}
                        >
                          {payingKey === key ? "…" : "Payer et réinitialiser"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {aPayer.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Aucune commission impayée sur ce mois.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="card overflow-x-auto">
          <h2 className="mb-4 text-lg font-semibold">Historique des versements</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-3 pr-4 font-medium">N°</th>
                <th className="pb-3 pr-4 font-medium">Date</th>
                <th className="pb-3 pr-4 font-medium">Bénéficiaire</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 pr-4 font-medium">Montant</th>
                <th className="pb-3 font-medium">Mode</th>
              </tr>
            </thead>
            <tbody>
              {historique.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-mono text-xs">{p.numero}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{new Date(p.datePaiement).toLocaleString("fr-FR")}</td>
                  <td className="py-3 pr-4">
                    {p.beneficiaire}
                    <span className="block text-[11px] text-slate-400">{p.utilisateur.identifiant}</span>
                  </td>
                  <td className="py-3 pr-4">{p.type === "VENTE" ? "Commercial" : "Contrôleur"}</td>
                  <td className="py-3 pr-4 font-medium">{formatFcfa(p.montant)}</td>
                  <td className="py-3">
                    {MODE_PAIEMENT_LABELS[p.modePaiement] ?? p.modePaiement}
                    {p.reference ? <span className="block text-[11px] text-slate-400">{p.reference}</span> : null}
                  </td>
                </tr>
              ))}
              {historique.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Aucun versement sur cette période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <PaginationBar page={page} pages={pages} total={total} onPage={(p) => { setPage(p); load(p); }} label="paiement" />
        </div>
      </main>
    </div>
  );
}
