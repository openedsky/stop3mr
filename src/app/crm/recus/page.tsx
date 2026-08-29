"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PdfLink } from "@/components/PdfLink";
import { PaginationBar, TableSearch, FilterField } from "@/components/PaginationBar";
import { MODE_PAIEMENT_LABELS, formatFcfa } from "@/lib/crm";

type Recu = {
  id: number;
  numero: string;
  montant: number;
  modePaiement: string;
  datePaiement: string;
  reference: string | null;
  client: { nom: string };
  facture: { numero: string };
};

export default function RecusPage() {
  const [recus, setRecus] = useState<Recu[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [modePaiement, setModePaiement] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function load(p = page, search = q, mode = modePaiement, du = from, au = to) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "20" });
    if (search) params.set("q", search);
    if (mode) params.set("modePaiement", mode);
    if (du) params.set("from", du);
    if (au) params.set("to", au);
    fetch(`/api/crm/recus?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setRecus(d.recus ?? []);
        setPages(d.pagination?.pages ?? 1);
        setTotal(d.pagination?.total ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(page, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Reçus de paiement</h1>
            <p className="text-slate-500">Historique des encaissements</p>
          </div>
          <Link href="/crm/recus/nouveau" className="btn-primary">
            Nouveau reçu
          </Link>
        </div>

        <div className="card">
          <TableSearch
            value={q}
            onChange={setQ}
            onSubmit={() => {
              setPage(1);
              load(1, q, modePaiement, from, to);
            }}
            placeholder="Rechercher n° reçu, facture, client…"
            filters={
              <>
                <FilterField label="Mode">
                  <select
                    className="input-field"
                    value={modePaiement}
                    onChange={(e) => {
                      setModePaiement(e.target.value);
                      setPage(1);
                      load(1, q, e.target.value, from, to);
                    }}
                  >
                    <option value="">Tous</option>
                    {Object.entries(MODE_PAIEMENT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Du">
                  <input
                    type="date"
                    className="input-field"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setPage(1);
                      load(1, q, modePaiement, e.target.value, to);
                    }}
                  />
                </FilterField>
                <FilterField label="Au">
                  <input
                    type="date"
                    className="input-field"
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setPage(1);
                      load(1, q, modePaiement, from, e.target.value);
                    }}
                  />
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
                    <th className="pb-3 pr-4 font-medium">N° reçu</th>
                    <th className="pb-3 pr-4 font-medium">Facture</th>
                    <th className="pb-3 pr-4 font-medium">Client</th>
                    <th className="pb-3 pr-4 font-medium">Montant</th>
                    <th className="pb-3 pr-4 font-medium">Mode</th>
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recus.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-mono text-xs">{r.numero}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{r.facture.numero}</td>
                      <td className="py-3 pr-4">{r.client.nom}</td>
                      <td className="py-3 pr-4 font-medium text-green-700">{formatFcfa(r.montant)}</td>
                      <td className="py-3 pr-4">{MODE_PAIEMENT_LABELS[r.modePaiement] ?? r.modePaiement}</td>
                      <td className="py-3 pr-4">{new Date(r.datePaiement).toLocaleDateString("fr-FR")}</td>
                      <td className="py-3">
                        <PdfLink href={`/api/crm/recus/${r.id}/pdf`} />
                      </td>
                    </tr>
                  ))}
                  {recus.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">Aucun reçu</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <PaginationBar page={page} pages={pages} total={total} onPage={setPage} label="reçu" />
        </div>
      </main>
    </div>
  );
}