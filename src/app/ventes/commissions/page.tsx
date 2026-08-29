"use client";

import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { PaginationBar, TableSearch, FilterField } from "@/components/PaginationBar";
import { formatFcfa, formatNombre } from "@/lib/money";
import { paginateItems } from "@/lib/pagination";

type Acteur = {
  id: number;
  identifiant: string;
  nom: string | null;
  quantite: number;
  chiffreAffaires: number;
  commission: number;
  commissionDue: number;
  commissionPayee: number;
  partEntreprise: number;
  parProduit: Array<{ libelle: string; quantite: number; ca: number; commission: number }>;
};

type Data = {
  totaux: {
    quantite: number;
    chiffreAffaires: number;
    commission: number;
    commissionDue: number;
    commissionPayee: number;
    partEntreprise: number;
  };
  acteurs: Acteur[];
};

export default function CommissionsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/commissions?${params}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredActeurs = useMemo(() => {
    if (!data) return [];
    const lower = q.trim().toLowerCase();
    return data.acteurs.filter(
      (a) =>
        !lower ||
        a.identifiant.toLowerCase().includes(lower) ||
        (a.nom?.toLowerCase().includes(lower) ?? false)
    );
  }, [data, q]);
  const { items: pageActeurs, pagination } = paginateItems(filteredActeurs, page, 8);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Synthèse des commissions</h1>
        <p className="mb-6 text-slate-500">
          Côte-part de chaque commercial sur les panneaux vendus. Le compteur « à payer » revient à zéro après
          le versement mensuel.
        </p>

        <form
          className="mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            load();
          }}
        >
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <FilterField label="Du">
              <input type="date" className="input-field" value={from} onChange={(e) => setFrom(e.target.value)} />
            </FilterField>
            <FilterField label="Au">
              <input type="date" className="input-field" value={to} onChange={(e) => setTo(e.target.value)} />
            </FilterField>
            <button type="submit" className="btn-secondary">
              Filtrer
            </button>
          </div>
        </form>
        <TableSearch
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          onSubmit={() => setPage(1)}
          placeholder="Rechercher un commercial…"
        />

        {loading || !data ? (
          <p className="text-slate-400">Chargement...</p>
        ) : (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="card">
                <p className="text-sm text-slate-500">Panneaux vendus</p>
                <p className="text-2xl font-bold">{formatNombre(data.totaux.quantite)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500">Chiffre d&apos;affaires</p>
                <p className="text-2xl font-bold">{formatFcfa(data.totaux.chiffreAffaires)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500">Commissions générées</p>
                <p className="text-2xl font-bold text-green-700">{formatFcfa(data.totaux.commission)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500">À payer</p>
                <p className="text-2xl font-bold text-amber-700">{formatFcfa(data.totaux.commissionDue ?? 0)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500">Déjà versées</p>
                <p className="text-2xl font-bold text-slate-800">{formatFcfa(data.totaux.commissionPayee ?? 0)}</p>
              </div>
            </div>

            <div className="space-y-4">
              {pageActeurs.map((a) => (
                <div key={a.id} className="card">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{a.nom ?? a.identifiant}</h2>
                      <p className="text-xs text-slate-400">{a.identifiant}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p>
                        {formatNombre(a.quantite)} vente(s) — CA {formatFcfa(a.chiffreAffaires)}
                      </p>
                      <p className="font-semibold text-green-700">Commission {formatFcfa(a.commission)}</p>
                      <p className="text-amber-700">Dû {formatFcfa(a.commissionDue ?? 0)}</p>
                      <p className="text-slate-500">Versé {formatFcfa(a.commissionPayee ?? 0)}</p>
                    </div>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500">
                        <th className="pb-2 font-medium">Produit</th>
                        <th className="pb-2 font-medium">Qté</th>
                        <th className="pb-2 font-medium">CA</th>
                        <th className="pb-2 font-medium">Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.parProduit.map((p) => (
                        <tr key={p.libelle} className="border-b border-slate-50">
                          <td className="py-2 pr-4">{p.libelle}</td>
                          <td className="py-2 pr-4">{formatNombre(p.quantite)}</td>
                          <td className="py-2 pr-4">{formatFcfa(p.ca)}</td>
                          <td className="py-2">{formatFcfa(p.commission)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {filteredActeurs.length === 0 && (
                <p className="text-center text-slate-400">Aucune vente sur la période.</p>
              )}
            </div>
            <PaginationBar
              page={pagination.page}
              pages={pagination.pages}
              total={pagination.total}
              onPage={setPage}
              label="commercial"
            />
          </>
        )}
      </main>
    </div>
  );
}
