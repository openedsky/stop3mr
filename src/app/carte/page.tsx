"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { CarteLegende } from "@/components/CentresMap";
import type { CentreCarte } from "@/lib/geo";
import { siteKey } from "@/lib/geo";
import { formatNombre } from "@/lib/money";
import { swalError } from "@/lib/swal";

const CentresMap = dynamic(() => import("@/components/CentresMap").then((m) => m.CentresMap), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Chargement de la carte...
    </div>
  ),
});

type Payload = {
  sites: CentreCarte[];
  totaux: {
    usines: number;
    centres: number;
    georeferences: number;
    couverts: number;
    stock: number;
    stockUsine: number;
    ventes: number;
    verifications: number;
  };
};

type Filtre = "tous" | "production" | "controle" | "sans-vendeur";

export default function CartePage() {
  const { status } = useSession();
  const [data, setData] = useState<Payload | null>(null);
  const [selected, setSelected] = useState<CentreCarte | null>(null);
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/carte")
      .then((r) => r.json())
      .then((d: Payload) => {
        if (!d?.sites || !d.totaux) {
          setError("Impossible de charger la carte");
          void swalError("Carte indisponible", "Impossible de charger la carte");
          return;
        }
        setData(d);
        const usine = d.sites.find((s) => s.kind === "production" && s.georeference);
        if (usine) setSelected(usine);
      })
      .catch(() => {
        setError("Impossible de charger la carte");
        void swalError("Carte indisponible", "Impossible de charger la carte");
      });
  }, [status]);

  const visibles = useMemo(() => {
    const list = data?.sites ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter((s) => {
      if (filtre === "production" && s.kind !== "production") return false;
      if (filtre === "controle" && s.kind !== "controle") return false;
      if (filtre === "sans-vendeur" && (s.kind !== "controle" || s.couvertVendeur)) return false;
      if (!needle) return true;
      return `${s.libelle} ${s.code} ${s.ville} ${s.commune} ${s.quartier}`.toLowerCase().includes(needle);
    });
  }, [data, filtre, q]);

  const selectedKey = selected ? siteKey(selected.kind, selected.id) : null;
  const couverture = data ? Math.round((data.totaux.couverts / Math.max(1, data.totaux.centres)) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold">Carte du réseau</h1>
        <p className="mb-6 text-slate-500">
          Usine de production (Yopougon) et centres de contrôle technique sur le territoire.
        </p>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {data && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <div className="card !border-violet-200 !py-4">
              <p className="text-xs text-violet-700">Usine production</p>
              <p className="text-2xl font-bold text-violet-800">{formatNombre(data.totaux.usines)}</p>
            </div>
            <div className="card !border-sky-200 !py-4">
              <p className="text-xs text-sky-700">Centres CT</p>
              <p className="text-2xl font-bold text-sky-800">{formatNombre(data.totaux.centres)}</p>
            </div>
            <div className="card !py-4">
              <p className="text-xs text-slate-500">Couverture vendeurs</p>
              <p className="text-2xl font-bold">{couverture}%</p>
              <p className="text-[11px] text-slate-400">{formatNombre(data.totaux.couverts)} sites</p>
            </div>
            <div className="card !py-4">
              <p className="text-xs text-slate-500">Stock usine</p>
              <p className="text-2xl font-bold text-violet-700">{formatNombre(data.totaux.stockUsine)}</p>
            </div>
            <div className="card !py-4">
              <p className="text-xs text-slate-500">Stock vendeurs</p>
              <p className="text-2xl font-bold text-green-700">{formatNombre(data.totaux.stock)}</p>
            </div>
            <div className="card !py-4">
              <p className="text-xs text-slate-500">Ventes</p>
              <p className="text-2xl font-bold text-blue-700">{formatNombre(data.totaux.ventes)}</p>
            </div>
            <div className="card !py-4">
              <p className="text-xs text-slate-500">Contrôles</p>
              <p className="text-2xl font-bold text-amber-700">{formatNombre(data.totaux.verifications)}</p>
            </div>
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <CarteLegende />
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["tous", "Tous les sites"],
              ["production", "Usine seulement"],
              ["controle", "Centres CT"],
              ["sans-vendeur", "CT sans vendeur"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltre(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                filtre === id ? "bg-red-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <CentresMap centres={visibles} selectedKey={selectedKey} onSelect={setSelected} />

          <aside className="space-y-3">
            <input
              className="input-field"
              placeholder="Rechercher ville, commune, code…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <p className="text-xs text-slate-400">
              {formatNombre(visibles.length)} point(s) sur la carte
              {q || filtre !== "tous" ? " (filtre actif)" : " — cherchez une ville pour lister les CT"}
            </p>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {(q || filtre !== "tous" ? visibles : visibles.filter((s) => s.kind === "production").concat(visibles.filter((s) => s.kind === "controle").slice(0, 12))).map(
                (c) => (
                  <button
                    key={siteKey(c.kind, c.id)}
                    type="button"
                    onClick={() => setSelected(c)}
                    className={`card w-full !p-3 text-left ${selectedKey === siteKey(c.kind, c.id) ? "border-red-300 ring-1 ring-red-200" : ""}`}
                  >
                    <p className={`text-[10px] font-semibold uppercase ${c.kind === "production" ? "text-violet-700" : "text-sky-700"}`}>
                      {c.kind === "production" ? "Production" : "Contrôle technique"}
                    </p>
                    <p className="font-semibold">{c.libelle}</p>
                    <p className="text-xs text-slate-500">{c.adresseComplete || "Adresse non renseignée"}</p>
                    {c.kind === "controle" && (
                      <p className="mt-1 text-xs text-slate-600">
                        {c.couvertVendeur ? `${formatNombre(c.stats.commerciaux)} vendeur(s)` : "Sans vendeur"} · {formatNombre(c.stats.stockDisponible)} dispo
                      </p>
                    )}
                  </button>
                )
              )}
            </div>
          </aside>
        </div>

        {selected && (
          <div className={`card mt-6 ${selected.kind === "production" ? "border-violet-200" : "border-sky-200"}`}>
            <p className={`text-xs font-semibold uppercase ${selected.kind === "production" ? "text-violet-700" : "text-sky-700"}`}>
              {selected.kind === "production" ? "Site de production (usine)" : "Site de contrôle technique"}
            </p>
            <h2 className="mb-1 text-lg font-semibold">{selected.libelle}</h2>
            <p className="mb-2 text-sm text-slate-500">{selected.adresseComplete}</p>
            {selected.georeference && (
              <p className="mb-4 font-mono text-xs text-slate-400">
                {selected.latitude?.toFixed(6)}, {selected.longitude?.toFixed(6)}
              </p>
            )}
            {selected.kind === "production" ? (
              <div className="rounded-lg bg-violet-50 px-3 py-2 text-sm">
                Stock confectionné non encore affecté
                <strong className="block text-lg">{formatNombre(selected.stats.stockDisponible)}</strong>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-green-50 px-3 py-2 text-sm">
                  Stock vendeur <strong className="block text-lg">{formatNombre(selected.stats.stockDisponible)}</strong>
                </div>
                <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm">
                  Ventes <strong className="block text-lg">{formatNombre(selected.stats.ventes)}</strong>
                </div>
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm">
                  Vérifications <strong className="block text-lg">{formatNombre(selected.stats.verifications)}</strong>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  Couverture
                  <strong className="block text-lg">{selected.couvertVendeur ? "Vendeur présent" : "Sans vendeur"}</strong>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
