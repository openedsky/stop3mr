"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PaginationBar, TableSearch, FilterField } from "@/components/PaginationBar";
import { formatFcfa } from "@/lib/money";
import { TYPE_CLIENT_LABELS } from "@/lib/clients";
import { CANAL_VENTE_LABELS } from "@/lib/ventes";

type Vente = {
  id: number;
  dateVente: string;
  prixVente: number;
  commissionMontant: number;
  canal?: "COMMERCIAL" | "DIRECTE";
  plaque: { numeroSerie: string; produit?: { libelle: string } | null };
  client: { nom: string; typeClient?: string; raisonSociale?: string | null };
  vendeur: { identifiant: string; nom: string | null; prenom?: string | null; codeCommercial?: number | null } | null;
  centre: { libelle: string } | null;
};

export default function VentesPage() {
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [centreId, setCentreId] = useState("");
  const [canal, setCanal] = useState("");
  const [centres, setCentres] = useState<Array<{ id: number; libelle: string; ville: string | null }>>([]);

  function load(p = page, search = q, du = from, au = to, centre = centreId, canalFiltre = canal) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "20" });
    if (search) params.set("q", search);
    if (du) params.set("from", du);
    if (au) params.set("to", au);
    if (centre) params.set("centreId", centre);
    if (canalFiltre) params.set("canal", canalFiltre);
    fetch(`/api/ventes?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setVentes(d.ventes ?? []);
        setPages(d.pagination?.pages ?? 1);
        setTotal(d.pagination?.total ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch("/api/centres?limit=80")
      .then((r) => r.json())
      .then((d) => setCentres(d.centres ?? []));
  }, []);

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
            <h1 className="text-2xl font-bold text-slate-900">Historique des ventes</h1>
            <p className="text-slate-500">
              Ventes des commerciaux et ventes directes (organisations, personnes morales ou physiques).
            </p>
          </div>
          <Link href="/ventes/nouvelle" className="btn-primary">
            Nouvelle vente
          </Link>
        </div>

        <div className="card overflow-x-auto">
          <TableSearch
            value={q}
            onChange={setQ}
            onSubmit={() => {
              setPage(1);
              load(1, q, from, to, centreId);
            }}
            placeholder="Rechercher série, client, commercial, centre…"
            filters={
              <>
                <FilterField label="Du">
                  <input
                    type="date"
                    className="input-field"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setPage(1);
                      load(1, q, e.target.value, to, centreId);
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
                      load(1, q, from, e.target.value, centreId);
                    }}
                  />
                </FilterField>
                <FilterField label="Centre CT">
                  <select
                    className="input-field"
                    value={centreId}
                    onChange={(e) => {
                      setCentreId(e.target.value);
                      setPage(1);
                      load(1, q, from, to, e.target.value);
                    }}
                  >
                    <option value="">Tous</option>
                    {centres.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.libelle}
                        {c.ville ? ` — ${c.ville}` : ""}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Canal">
                  <select
                    className="input-field"
                    value={canal}
                    onChange={(e) => {
                      setCanal(e.target.value);
                      setPage(1);
                      load(1, q, from, to, centreId, e.target.value);
                    }}
                  >
                    <option value="">Tous</option>
                    <option value="DIRECTE">{CANAL_VENTE_LABELS.DIRECTE}</option>
                    <option value="COMMERCIAL">{CANAL_VENTE_LABELS.COMMERCIAL}</option>
                  </select>
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
                  <th className="pb-3 pr-4 font-medium">Série</th>
                  <th className="pb-3 pr-4 font-medium">Produit</th>
                  <th className="pb-3 pr-4 font-medium">Client</th>
                  <th className="pb-3 pr-4 font-medium">Canal</th>
                  <th className="pb-3 pr-4 font-medium">Commercial</th>
                  <th className="pb-3 pr-4 font-medium">Centre CT</th>
                  <th className="pb-3 pr-4 font-medium">Prix</th>
                  <th className="pb-3 font-medium">Commission</th>
                </tr>
              </thead>
              <tbody>
                {ventes.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {new Date(v.dateVente).toLocaleString("fr-FR")}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">{v.plaque.numeroSerie}</td>
                    <td className="py-3 pr-4">{v.plaque.produit?.libelle ?? "—"}</td>
                    <td className="py-3 pr-4">
                      {v.client.nom}
                      <span className="block text-[11px] text-slate-400">
                        {TYPE_CLIENT_LABELS[v.client.typeClient ?? ""] ?? ""}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`badge ${v.canal === "DIRECTE" ? "badge-neutral" : "badge-info"}`}>
                        {CANAL_VENTE_LABELS[v.canal ?? "COMMERCIAL"]}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {v.canal === "DIRECTE"
                        ? "—"
                        : v.vendeur?.codeCommercial != null
                          ? `${v.vendeur.codeCommercial} — `
                          : ""}
                      {v.canal === "DIRECTE"
                        ? null
                        : v.vendeur?.prenom || v.vendeur?.nom
                          ? [v.vendeur.prenom, v.vendeur.nom].filter(Boolean).join(" ")
                          : (v.vendeur?.identifiant ?? "—")}
                    </td>
                    <td className="py-3 pr-4">{v.centre?.libelle ?? "—"}</td>
                    <td className="py-3 pr-4">{formatFcfa(v.prixVente)}</td>
                    <td className={`py-3 font-medium ${v.commissionMontant ? "text-green-700" : "text-slate-400"}`}>
                      {v.canal === "DIRECTE" || !v.commissionMontant ? "Sans commission" : formatFcfa(v.commissionMontant)}
                    </td>
                  </tr>
                ))}
                {ventes.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Aucune vente.{" "}
                      <Link href="/ventes/nouvelle" className="text-red-600 hover:underline">
                        Enregistrer une vente
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          <PaginationBar page={page} pages={pages} total={total} onPage={setPage} label="vente" />
        </div>
      </main>
    </div>
  );
}
