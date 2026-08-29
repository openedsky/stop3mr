"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { PaginationBar } from "@/components/PaginationBar";
import { PdfLink } from "@/components/PdfLink";

type Plaque = {
  id: number;
  numeroSerie: string;
  statut: string;
  typeProduit: string;
  dateFabrication: string;
  affecteeLe: string | null;
  produit?: { libelle: string } | null;
  vente?: { dateVente: string } | null;
  verifications?: Array<{ horodatage: string }>;
};

function StockPlaquesList() {
  const searchParams = useSearchParams();
  const initialSite = searchParams.get("site") ?? "";
  const initialProduit = searchParams.get("produitId") ?? "";
  const initialStatut = searchParams.get("statut") ?? "";

  const [plaques, setPlaques] = useState<Plaque[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [statut, setStatut] = useState(initialStatut);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  function load(p = page, search = searchQ, st = statut) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "20" });
    if (search) params.set("q", search);
    if (st) params.set("statut", st);
    if (initialSite) params.set("site", initialSite);
    if (initialProduit) params.set("produitId", initialProduit);
    fetch(`/api/plaques?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setPlaques(d.plaques ?? []);
        setPages(d.pagination?.pages ?? 1);
        setTotal(d.pagination?.total ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(page, searchQ, statut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statut]);

  function handleSearch(e?: FormEvent, p = 1) {
    e?.preventDefault();
    setPage(p);
    load(p, searchQ, statut);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <Link href="/production/stock" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Stock production
        </Link>
        <h1 className="mb-2 text-2xl font-bold">Détail des plaques</h1>
        <p className="mb-6 text-slate-500">
          Fabrication, mise à disposition, vente, contrôle et PDF QR (un QR 2 cm × 2 cm par fichier A4).
        </p>

        <div className="card overflow-x-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(undefined, 1);
            }}
            className="mb-4 flex flex-wrap gap-2"
          >
            <input
              className="input-field min-w-[220px] flex-1"
              placeholder="Rechercher un numéro de série…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
            <select
              className="input-field max-w-[200px]"
              value={statut}
              onChange={(e) => {
                setStatut(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tous les statuts</option>
              <option value="EN_STOCK">En stock</option>
              <option value="AFFECTEE">Chez le vendeur</option>
              <option value="VENDUE">Vendue</option>
            </select>
            <button type="submit" className="btn-secondary shrink-0">
              Rechercher
            </button>
          </form>

          {loading ? (
            <p className="text-slate-400">Chargement...</p>
          ) : (
            <>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-2 pr-4">Série</th>
                    <th className="pb-2 pr-4">Produit</th>
                    <th className="pb-2 pr-4">Statut</th>
                    <th className="pb-2 pr-4">Fabrication</th>
                    <th className="pb-2 pr-4">Mise à disposition</th>
                    <th className="pb-2 pr-4">Vente</th>
                    <th className="pb-2 pr-4">Contrôle</th>
                    <th className="pb-2">QR</th>
                  </tr>
                </thead>
                <tbody>
                  {plaques.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-mono text-xs">{p.numeroSerie}</td>
                      <td className="py-2 pr-4">{p.produit?.libelle ?? p.typeProduit.replace("_", " ")}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`badge ${
                            p.statut === "VENDUE"
                              ? "badge-success"
                              : p.statut === "AFFECTEE"
                                ? "badge-info"
                                : "badge-warning"
                          }`}
                        >
                          {p.statut.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap text-xs">
                        {new Date(p.dateFabrication).toLocaleString("fr-FR")}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap text-xs">
                        {p.affecteeLe ? new Date(p.affecteeLe).toLocaleString("fr-FR") : "—"}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap text-xs">
                        {p.vente?.dateVente ? new Date(p.vente.dateVente).toLocaleString("fr-FR") : "—"}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap text-xs">
                        {p.verifications?.[0]?.horodatage
                          ? new Date(p.verifications[0].horodatage).toLocaleString("fr-FR")
                          : "—"}
                      </td>
                      <td className="py-2">
                        <PdfLink href={`/api/plaques/qr-pdf?serie=${encodeURIComponent(p.numeroSerie)}`}>PDF</PdfLink>
                      </td>
                    </tr>
                  ))}
                  {plaques.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Aucune plaque pour ce filtre.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <PaginationBar
                page={page}
                pages={pages}
                total={total}
                onPage={(p) => handleSearch(undefined, p)}
                label="plaque"
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function StockPlaquesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Chargement...</div>}>
      <StockPlaquesList />
    </Suspense>
  );
}
