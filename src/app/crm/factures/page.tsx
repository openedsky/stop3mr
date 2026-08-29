"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PdfLink } from "@/components/PdfLink";
import { PaginationBar, TableSearch, FilterField } from "@/components/PaginationBar";
import { FACTURE_STATUT_LABELS, formatFcfa } from "@/lib/crm";

type Facture = {
  id: number;
  numero: string;
  montantTtc: number;
  montantPaye: number;
  solde: number;
  statut: string;
  dateEmission: string;
  client: { id: number; nom: string; immatriculation: string };
};

export default function FacturesPage() {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(true);
  const [statut, setStatut] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchKey, setSearchKey] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statut === "impayees") params.set("impayees", "true");
    else if (statut) params.set("statut", statut);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q) params.set("q", q);
    setLoading(true);
    fetch(`/api/crm/factures?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setFactures(d.factures ?? []);
        setPages(d.pagination?.pages ?? 1);
        setTotal(d.pagination?.total ?? 0);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statut, from, to, page, searchKey]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Factures</h1>
            <p className="text-slate-500">Suivi de la facturation clients</p>
          </div>
          <div className="flex gap-2">
            <Link href="/crm/factures/nouveau" className="btn-primary">
              Nouvelle facture
            </Link>
          </div>
        </div>

        <div className="card">
          <TableSearch
            value={q}
            onChange={setQ}
            onSubmit={() => {
              setPage(1);
              setSearchKey((k) => k + 1);
            }}
            placeholder="Rechercher n° facture, client…"
            filters={
              <>
                <FilterField label="Statut">
                  <select
                    className="input-field"
                    value={statut}
                    onChange={(e) => {
                      setStatut(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Tous</option>
                    <option value="impayees">Impayées</option>
                    {Object.entries(FACTURE_STATUT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Du">
                  <input type="date" className="input-field" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
                </FilterField>
                <FilterField label="Au">
                  <input type="date" className="input-field" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
                </FilterField>
              </>
            }
          />
          {loading ? (
            <p className="py-8 text-center text-slate-400">Chargement...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-3 pr-4 font-medium">N°</th>
                    <th className="pb-3 pr-4 font-medium">Client</th>
                    <th className="pb-3 pr-4 font-medium">TTC</th>
                    <th className="pb-3 pr-4 font-medium">Payé</th>
                    <th className="pb-3 pr-4 font-medium">Solde</th>
                    <th className="pb-3 pr-4 font-medium">Statut</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {factures.map((f) => (
                    <tr key={f.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-mono text-xs">{f.numero}</td>
                      <td className="py-3 pr-4">
                        <Link href={`/crm/situation?clientId=${f.client.id}`} className="hover:text-red-600">
                          {f.client.nom}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">{formatFcfa(f.montantTtc)}</td>
                      <td className="py-3 pr-4">{formatFcfa(f.montantPaye)}</td>
                      <td className="py-3 pr-4 font-medium text-amber-700">{formatFcfa(f.solde)}</td>
                      <td className="py-3 pr-4">
                        <span className="badge badge-info">{FACTURE_STATUT_LABELS[f.statut] ?? f.statut}</span>
                      </td>
                      <td className="py-3 space-x-2">
                        <PdfLink href={`/api/crm/factures/${f.id}/pdf`} />
                        {f.solde > 0 && (
                          <Link href={`/crm/recus/nouveau?factureId=${f.id}`} className="text-xs text-red-600 hover:underline">
                            Paiement
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                  {factures.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">Aucune facture</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <PaginationBar page={page} pages={pages} total={total} onPage={setPage} label="facture" />
        </div>
      </main>
    </div>
  );
}