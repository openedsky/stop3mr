"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PaginationBar, FilterField } from "@/components/PaginationBar";
import { ValiditeBadge } from "@/components/ValiditeBadge";
import { formatNombre } from "@/lib/money";
import { StatutValidite } from "@/lib/validite";

type Row = {
  id: number;
  numeroSerie: string;
  produit: string;
  clientNom: string;
  immatriculation: string | null;
  dateVente: string;
  validite: {
    statut: StatutValidite;
    dateAchat: string | null;
    dateExpiration: string | null;
    joursRestants: number | null;
  };
};

export default function ExpirationsPage() {
  const [statut, setStatut] = useState<"EXPIREE" | "EXPIRE_BIENTOT">("EXPIREE");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [expirees, setExpirees] = useState(0);
  const [expireBientot, setExpireBientot] = useState(0);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [validiteMois, setValiditeMois] = useState(24);

  function load(p = page, s = statut) {
    setLoading(true);
    fetch(`/api/expirations?statut=${s}&page=${p}&limit=30`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.plaques ?? []);
        setExpirees(d.compteurs?.expirees ?? 0);
        setExpireBientot(d.compteurs?.expireBientot ?? 0);
        setPages(d.pagination?.pages ?? 1);
        setTotal(d.pagination?.total ?? 0);
        setValiditeMois(d.settings?.plaqueValiditeMois ?? 24);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(page, statut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statut]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link href="/admin" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Administration
        </Link>
        <h1 className="mb-2 text-2xl font-bold">Alertes de validité des plaques</h1>
        <p className="mb-6 text-slate-500">
          Une plaque reste valide {validiteMois} mois à compter de la date d&apos;achat par le consommateur final.
        </p>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            className={`card text-left ${statut === "EXPIREE" ? "ring-2 ring-red-500" : ""}`}
            onClick={() => {
              setStatut("EXPIREE");
              setPage(1);
            }}
          >
            <p className="text-sm text-slate-500">Plaques expirées</p>
            <p className="text-3xl font-bold text-red-700">{formatNombre(expirees)}</p>
          </button>
          <button
            type="button"
            className={`card text-left ${statut === "EXPIRE_BIENTOT" ? "ring-2 ring-amber-500" : ""}`}
            onClick={() => {
              setStatut("EXPIRE_BIENTOT");
              setPage(1);
            }}
          >
            <p className="text-sm text-slate-500">Expiration proche</p>
            <p className="text-3xl font-bold text-amber-600">{formatNombre(expireBientot)}</p>
          </button>
        </div>

        <div className="card overflow-x-auto">
          <div className="mb-4">
            <FilterField label="Alerte">
              <select
                className="input-field"
                value={statut}
                onChange={(e) => {
                  setStatut(e.target.value as typeof statut);
                  setPage(1);
                }}
              >
                <option value="EXPIREE">Expirées</option>
                <option value="EXPIRE_BIENTOT">Expirent bientôt</option>
              </select>
            </FilterField>
          </div>
          {loading ? (
            <p className="text-slate-400">Chargement...</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-3 pr-4 font-medium">Série</th>
                  <th className="pb-3 pr-4 font-medium">Produit</th>
                  <th className="pb-3 pr-4 font-medium">Client</th>
                  <th className="pb-3 pr-4 font-medium">Achat</th>
                  <th className="pb-3 pr-4 font-medium">Expiration</th>
                  <th className="pb-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-mono text-xs">{r.numeroSerie}</td>
                    <td className="py-3 pr-4">{r.produit}</td>
                    <td className="py-3 pr-4">
                      {r.clientNom}
                      {r.immatriculation ? (
                        <span className="block text-xs text-slate-400">{r.immatriculation}</span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {r.validite.dateAchat ? new Date(r.validite.dateAchat).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {r.validite.dateExpiration
                        ? new Date(r.validite.dateExpiration).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    <td className="py-3">
                      <ValiditeBadge statut={r.validite.statut} joursRestants={r.validite.joursRestants} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Aucune plaque dans cette alerte.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          <PaginationBar page={page} pages={pages} total={total} onPage={setPage} label="plaque" />
        </div>
      </main>
    </div>
  );
}
