"use client";

import { FormEvent, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { PaginationBar, TableSearch, FilterField } from "@/components/PaginationBar";
import { PdfLink } from "@/components/PdfLink";
import { Req } from "@/components/Req";
import { swalConfirm, swalError, swalSuccess } from "@/lib/swal";

type Site = { code: string; libelle: string; ville: string | null };
type Produit = {
  id: number;
  code: string;
  libelle: string;
  vitessesDisponibles: string | null;
  actif: boolean;
};

type PlaqueResult = {
  plaque: {
    id: number;
    numeroSerie: string;
    qrCodeData: string;
    typeProduit: string;
    siteProduction: string;
    dateFabrication: string;
    statut: string;
    vitesseLimitation?: number | null;
  };
  verifyUrl: string;
  quantite?: number;
  series?: string[];
};

type PlaqueRow = {
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

export default function OperatorPage() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [produitId, setProduitId] = useState("");
  const [vitesse, setVitesse] = useState("");
  const [quantite, setQuantite] = useState("1");
  const [siteUnique, setSiteUnique] = useState<Site | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlaqueResult | null>(null);
  const [error, setError] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [statut, setStatut] = useState("");
  const [plaques, setPlaques] = useState<PlaqueRow[]>([]);
  const [listPage, setListPage] = useState(1);
  const [listPages, setListPages] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);

  function loadPlaques(p = listPage, search = searchQ, st = statut) {
    setListLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "20" });
    if (search) params.set("q", search);
    if (st) params.set("statut", st);
    fetch(`/api/plaques?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setPlaques(d.plaques ?? []);
        setListPage(d.pagination?.page ?? p);
        setListPages(d.pagination?.pages ?? 1);
        setListTotal(d.pagination?.total ?? 0);
      })
      .finally(() => setListLoading(false));
  }

  useEffect(() => {
    fetch("/api/admin/sites")
      .then((r) => r.json())
      .then((d) => {
        const actifs = (d.sites ?? []).filter((s: Site & { actif?: boolean }) => s.actif !== false);
        setSiteUnique(actifs[0] ?? d.sites?.[0] ?? null);
      });
    fetch("/api/produits")
      .then((r) => r.json())
      .then((d) => {
        const actifs = (d.produits ?? []).filter((p: Produit) => p.actif);
        setProduits(actifs);
        if (actifs[0]) setProduitId(String(actifs[0].id));
      });
    loadPlaques(1, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProduit = produits.find((p) => String(p.id) === produitId);
  const vitesses = selectedProduit?.vitessesDisponibles
    ? selectedProduit.vitessesDisponibles.split(",").map((v) => v.trim())
    : [];

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const ok = await swalConfirm("Produire ces plaques ?", `${quantite} plaque(s) vont être créées.`, "Produire");
    if (!ok) return;
    setLoading(true);
    setError("");
    setResult(null);

    const res = await fetch("/api/plaques", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        produitId: Number(produitId),
        vitesseLimitation: vitesse ? Number(vitesse) : undefined,
        quantite: Number(quantite),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      await swalError("Production impossible", data.error ?? "Erreur lors de la création");
      setError(data.error ?? "Erreur lors de la création");
      return;
    }

    const data = await res.json();
    setResult(data);
    await swalSuccess(
      "Plaques produites",
      data.series?.length > 1
        ? `${data.series.length} PDF QR (un par plaque) vont être téléchargés.`
        : "Le PDF QR A4 va être téléchargé."
    );
    const series: string[] = data.series?.length ? data.series : [data.plaque.numeroSerie];
    await downloadQrPdfs(series);
    loadPlaques(1, searchQ);
  }

  async function downloadQrPdfs(series: string[]) {
    for (const serie of series) {
      const res = await fetch(`/api/plaques/qr-pdf?serie=${encodeURIComponent(serie)}`);
      if (!res.ok) {
        await swalError("PDF indisponible", `Impossible de générer le QR de ${serie}.`);
        continue;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-${serie}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  function handleSearch(e?: FormEvent, p = 1) {
    e?.preventDefault();
    setListPage(p);
    loadPlaques(p, searchQ);
  }

  const selectedSite = siteUnique;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Module Production</h1>
        <p className="mb-3 text-slate-500">
          Confection des plaques du catalogue — numéro de série et QR code générés automatiquement. Le stock est ensuite
          mis à disposition des commerciaux.
        </p>
        <p className="mb-8 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
          Usine unique : <strong>Yopougon (code YP)</strong>. Les ventes et vérifications se font dans les centres de
          contrôle technique, pas à l&apos;usine.
        </p>

        <div className="card w-full">
          <h2 className="mb-4 text-lg font-semibold">Nouvelle plaque</h2>
          <form onSubmit={handleCreate} className="grid w-full grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Produit du catalogue<Req /></label>
              <select
                className="input-field w-full"
                value={produitId}
                onChange={(e) => {
                  setProduitId(e.target.value);
                  setVitesse("");
                }}
                required
              >
                {produits.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Vitesse (km/h){vitesses.length > 0 ? <Req /> : null}</label>
              {vitesses.length > 0 ? (
                <select className="input-field w-full" value={vitesse} onChange={(e) => setVitesse(e.target.value)} required>
                  <option value="">— Choisir —</option>
                  {vitesses.map((v) => (
                    <option key={v} value={v}>
                      {v} km/h
                    </option>
                  ))}
                </select>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Non applicable pour ce produit
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Quantité<Req /></label>
              <input
                className="input-field w-full"
                type="number"
                min={1}
                max={50}
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Site de production</label>
              {selectedSite ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <strong>{selectedSite.code}</strong> — {selectedSite.libelle}
                  {selectedSite.ville ? ` (${selectedSite.ville})` : ""}
                  <span className="mt-1 block text-xs text-slate-400">Usine unique du système</span>
                </p>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Aucun site configuré. Un administrateur doit ajouter l&apos;usine dans{" "}
                  <a href="/admin/sites" className="font-medium underline">
                    Administration → Sites
                  </a>
                  .
                </p>
              )}
              <p className="mt-1 text-xs text-slate-400">
                Format : R3M-{selectedSite?.code || "YP"}-AAMMJJ-XXXXXX
              </p>
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2">{error}</p>
            )}
            <div className="md:col-span-2">
              <button type="submit" className="btn-primary w-full" disabled={loading || !selectedSite}>
                {loading ? "Génération en cours..." : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>

        {result && (
          <div className="card mt-6 grid w-full gap-6 md:grid-cols-2">
            <div>
              <h2 className="mb-4 text-lg font-semibold text-green-700">
                {result.quantite && result.quantite > 1 ? `${result.quantite} plaques créées` : "Plaque créée"}
              </h2>
              <p>
                <span className="text-sm text-slate-500">Dernier numéro de série</span>
                <br />
                <span className="font-mono text-lg font-bold text-slate-900">{result.plaque.numeroSerie}</span>
              </p>
              {result.series && result.series.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs">
                  {result.series.map((serie) => (
                    <li key={serie} className="flex items-center justify-between gap-2 font-mono">
                      <span>{serie}</span>
                      <PdfLink href={`/api/plaques/qr-pdf?serie=${encodeURIComponent(serie)}`}>PDF QR</PdfLink>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-slate-500">Un PDF par plaque (QR 2 cm × 2 cm). Pas de fichier groupé.</p>
            </div>
            <div className="flex items-center justify-center">
              <div className="rounded-lg border border-slate-200 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.plaque.qrCodeData}
                  alt={`QR Code ${result.plaque.numeroSerie}`}
                  width={200}
                  height={200}
                />
              </div>
            </div>
          </div>
        )}

        <div className="card mt-8 overflow-x-auto">
          <h2 className="mb-4 text-lg font-semibold">Toutes les plaques</h2>
          <TableSearch
            value={searchQ}
            onChange={setSearchQ}
            onSubmit={() => handleSearch(undefined, 1)}
            placeholder="Rechercher un numéro de série…"
            filters={
              <FilterField label="Statut">
                <select
                  className="input-field"
                  value={statut}
                  onChange={(e) => {
                    setStatut(e.target.value);
                    setListPage(1);
                    loadPlaques(1, searchQ, e.target.value);
                  }}
                >
                  <option value="">Tous</option>
                  <option value="EN_STOCK">En stock</option>
                  <option value="AFFECTEE">Chez le vendeur</option>
                  <option value="VENDUE">Vendue</option>
                </select>
              </FilterField>
            }
          />
          {listLoading ? (
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
                        Aucune plaque.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <PaginationBar
                page={listPage}
                pages={listPages}
                total={listTotal}
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
