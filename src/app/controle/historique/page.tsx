"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PaginationBar, TableSearch, FilterField } from "@/components/PaginationBar";
import { formatFcfa } from "@/lib/money";

type Entry = {
  id: number;
  numeroSaisi: string;
  resultat: string;
  notes: string | null;
  immatriculationObservee: string | null;
  horodatage: string;
  agent: { identifiant: string; nom: string | null };
  centre: { libelle: string; ville: string | null } | null;
  plaque: { numeroSerie: string; produit: { libelle: string } | null } | null;
  commissionMontant?: number;
};

const RESULT_LABEL: Record<string, string> = {
  AUTHENTIQUE: "Authentique",
  INCONNUE: "Inconnue",
  CONTREFAITE: "Contrefaçon",
};

export default function HistoriqueControlePage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [pages, setPages] = useState(1);
  const [resultat, setResultat] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function load(p = page, search = q, res = resultat, du = from, au = to) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "30" });
    if (search) params.set("q", search);
    if (res) params.set("resultat", res);
    if (du) params.set("from", du);
    if (au) params.set("to", au);
    fetch(`/api/controle/verifications?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.verifications ?? []);
        setTotal(d.pagination?.total ?? 0);
        setPages(d.pagination?.pages ?? 1);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Historique des vérifications</h1>
            <p className="text-slate-500">{total} contrôle(s) enregistré(s)</p>
          </div>
          <Link href="/controle/verification" className="btn-primary">
            Nouvelle vérification
          </Link>
        </div>

        <div className="card overflow-x-auto">
          <TableSearch
            value={q}
            onChange={setQ}
            onSubmit={() => {
              setPage(1);
              load(1, q, resultat, from, to);
            }}
            placeholder="Rechercher numéro saisi, immatriculation…"
            filters={
              <>
                <FilterField label="Résultat">
                  <select
                    className="input-field"
                    value={resultat}
                    onChange={(e) => {
                      setResultat(e.target.value);
                      setPage(1);
                      load(1, q, e.target.value, from, to);
                    }}
                  >
                    <option value="">Tous</option>
                    {Object.entries(RESULT_LABEL).map(([k, v]) => (
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
                      load(1, q, resultat, e.target.value, to);
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
                      load(1, q, resultat, from, e.target.value);
                    }}
                  />
                </FilterField>
              </>
            }
          />
          {loading ? (
            <p className="text-slate-400">Chargement...</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-3 pr-4 font-medium">Date</th>
                  <th className="pb-3 pr-4 font-medium">Numéro saisi</th>
                  <th className="pb-3 pr-4 font-medium">Résultat</th>
                  <th className="pb-3 pr-4 font-medium">Produit</th>
                  <th className="pb-3 pr-4 font-medium">Immat. observée</th>
                  <th className="pb-3 pr-4 font-medium">Agent</th>
                  <th className="pb-3 pr-4 font-medium">Commission</th>
                  <th className="pb-3 font-medium">Centre</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 whitespace-nowrap">{new Date(e.horodatage).toLocaleString("fr-FR")}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{e.numeroSaisi}</td>
                    <td className="py-3 pr-4">
                      <span className={`badge ${e.resultat === "AUTHENTIQUE" ? "badge-success" : e.resultat === "CONTREFAITE" ? "badge-warning" : "badge-info"}`}>
                        {RESULT_LABEL[e.resultat] ?? e.resultat}
                      </span>
                    </td>
                    <td className="py-3 pr-4">{e.plaque?.produit?.libelle ?? "—"}</td>
                    <td className="py-3 pr-4">{e.immatriculationObservee ?? "—"}</td>
                    <td className="py-3 pr-4">{e.agent.nom ?? e.agent.identifiant}</td>
                    <td className="py-3 pr-4">{e.commissionMontant ? formatFcfa(e.commissionMontant) : "—"}</td>
                    <td className="py-3">{e.centre?.libelle ?? "—"}</td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Aucun historique.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <PaginationBar page={page} pages={pages} total={total} onPage={setPage} label="contrôle" />
      </main>
    </div>
  );
}
