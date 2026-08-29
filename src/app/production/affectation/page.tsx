"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { CommercialSelect, type CommercialOption } from "@/components/CommercialSelect";
import { Req } from "@/components/Req";
import { swalConfirm, swalError, swalSuccess } from "@/lib/swal";

type Produit = { id: number; code: string; libelle: string };
type Plaque = { id: number; numeroSerie: string; produit?: { libelle: string } | null; siteProduction: string };
type StockItem = { site: string; type: string; produitId?: number | null; quantite: number };

export default function AffectationPage() {
  const [commerciaux, setCommerciaux] = useState<CommercialOption[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [plaques, setPlaques] = useState<Plaque[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [commercialId, setCommercialId] = useState("");
  const [produitId, setProduitId] = useState("");
  const [quantite, setQuantite] = useState("1");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mode, setMode] = useState<"lot" | "series">("lot");
  const [serieSearch, setSerieSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function reload() {
    const [cRes, pRes, stRes] = await Promise.all([
      fetch("/api/commerciaux").then((r) => r.json()).catch(() => ({})),
      fetch("/api/produits").then((r) => r.json()).catch(() => ({})),
      fetch("/api/stock").then((r) => r.json()).catch(() => ({})),
    ]);
    setCommerciaux(cRes.commerciaux ?? []);
    setProduits((pRes.produits ?? []).filter((x: { actif: boolean }) => x.actif !== false));
    setStock(stRes.stock ?? []);
    setSelectedIds([]);
    if (mode === "series") {
      const pl = await fetch("/api/plaques?statut=EN_STOCK&limit=500")
        .then((r) => r.json())
        .catch(() => ({ plaques: [] }));
      setPlaques(pl.plaques ?? []);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (mode !== "series") return;
    fetch("/api/plaques?statut=EN_STOCK&limit=500")
      .then((r) => r.json())
      .then((pl) => setPlaques(pl.plaques ?? []))
      .catch(() => setPlaques([]));
  }, [mode]);

  const stockParProduit = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of stock) {
      if (!s.produitId) continue;
      map.set(s.produitId, (map.get(s.produitId) ?? 0) + s.quantite);
    }
    return map;
  }, [stock]);

  const stockDispo = produitId ? stockParProduit.get(Number(produitId)) ?? 0 : 0;
  const qty = Math.max(1, Number(quantite) || 1);

  useEffect(() => {
    if (!produitId) return;
    const max = stockParProduit.get(Number(produitId)) ?? 0;
    if (max > 0 && Number(quantite) > max) setQuantite(String(max));
  }, [produitId, stockParProduit, quantite]);

  const plaquesFiltrees = useMemo(() => {
    const q = serieSearch.trim().toLowerCase();
    if (!q) return plaques;
    return plaques.filter(
      (p) =>
        p.numeroSerie.toLowerCase().includes(q) ||
        (p.produit?.libelle ?? "").toLowerCase().includes(q)
    );
  }, [plaques, serieSearch]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!commercialId) {
      setError("Sélectionnez un commercial.");
      return;
    }
    if (mode === "lot") {
      if (!produitId) {
        setError("Sélectionnez un produit.");
        return;
      }
      if (qty > stockDispo) {
        setError(`Stock insuffisant : ${stockDispo} plaque(s) réellement disponible(s) pour ce produit.`);
        return;
      }
    } else if (selectedIds.length === 0) {
      setError("Sélectionnez au moins une plaque en stock.");
      return;
    }

    const ok = await swalConfirm(
      "Confirmer l'affectation ?",
      mode === "lot" ? `${qty} plaque(s) seront affectées (stock : ${stockDispo}).` : `${selectedIds.length} plaque(s) seront affectées.`,
      "Affecter"
    );
    if (!ok) return;
    setLoading(true);
    setError("");
    setSuccess("");

    const payload =
      mode === "lot"
        ? {
            commercialId: Number(commercialId),
            produitId: Number(produitId),
            quantite: qty,
          }
        : {
            commercialId: Number(commercialId),
            plaqueIds: selectedIds,
          };

    const res = await fetch("/api/allocations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      await swalError("Affectation impossible", data.error ?? "Erreur d'affectation");
      setError(data.error ?? "Erreur d'affectation");
      await reload();
      return;
    }

    setSuccess(`${data.affectees} plaque(s) mises à disposition de ${data.commercial.nom ?? data.commercial.identifiant}`);
    await swalSuccess("Affectation enregistrée", `${data.affectees} plaque(s) mises à disposition.`);
    setQuantite("1");
    reload();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/production/stock" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Stock production
        </Link>
        <h1 className="mb-2 text-2xl font-bold">Mettre les plaques à disposition des vendeurs</h1>
        <p className="mb-8 text-slate-500">
          La quantité affectée est plafonnée au stock réellement disponible en base (plaques au statut en stock).
        </p>

        {success && <p className="card mb-6 border-green-200 bg-green-50 text-green-800">{success}</p>}

        <form onSubmit={handleSubmit} className="card space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium">Commercial<Req /></label>
            <CommercialSelect commerciaux={commerciaux} value={commercialId} onChange={setCommercialId} />
            {commerciaux.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Aucun commercial. Créez un compte dans Administration → Utilisateurs.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className={mode === "lot" ? "btn-primary !py-2 !text-xs" : "btn-secondary !py-2 !text-xs"}
              onClick={() => setMode("lot")}
            >
              Par lot (produit + quantité)
            </button>
            <button
              type="button"
              className={mode === "series" ? "btn-primary !py-2 !text-xs" : "btn-secondary !py-2 !text-xs"}
              onClick={() => setMode("series")}
            >
              Par numéros de série
            </button>
          </div>

          {mode === "lot" ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">Produit<Req /></label>
                <select className="input-field" value={produitId} onChange={(e) => setProduitId(e.target.value)} required>
                  <option value="">— Produit du catalogue —</option>
                  {produits.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.libelle} — stock : {stockParProduit.get(p.id) ?? 0}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Quantité<Req /></label>
                <input
                  className="input-field"
                  type="number"
                  min={1}
                  max={Math.max(1, stockDispo)}
                  value={quantite}
                  onChange={(e) => setQuantite(e.target.value)}
                  required
                />
                <p className={`mt-1 text-xs ${stockDispo > 0 ? "text-slate-500" : "text-amber-600"}`}>
                  Stock réellement disponible : <strong>{stockDispo}</strong>
                  {produitId && stockDispo === 0 ? " — aucune plaque en stock pour ce produit." : ""}
                </p>
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium">Plaques en stock production</label>
              <input
                className="input-field mb-2"
                placeholder="Rechercher un numéro de série…"
                value={serieSearch}
                onChange={(e) => setSerieSearch(e.target.value)}
              />
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                {plaquesFiltrees.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 border-b border-slate-50 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={(e) =>
                        setSelectedIds((prev) =>
                          e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                        )
                      }
                    />
                    <span className="font-mono text-xs">{p.numeroSerie}</span>
                    <span className="text-slate-500">{p.produit?.libelle ?? p.siteProduction}</span>
                  </label>
                ))}
                {plaquesFiltrees.length === 0 && (
                  <p className="px-3 py-4 text-sm text-slate-400">Aucune plaque en stock.</p>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {selectedIds.length} sélectionnée(s) · {plaques.length} plaque(s) réellement en stock
              </p>
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading || !commercialId || (mode === "lot" && (!produitId || stockDispo < 1))}
          >
            {loading ? "Transfert..." : "Mettre à disposition"}
          </button>
        </form>
      </main>
    </div>
  );
}
