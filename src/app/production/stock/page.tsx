"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { formatNombre } from "@/lib/money";

type StockItem = {
  site: string;
  type: string;
  produitId?: number | null;
  quantite: number;
};

type StockData = {
  resume: { total: number; enStock: number; vendues: number; affectees?: number };
  stock: StockItem[];
  stockAffecte?: StockItem[];
  alertes: StockItem[];
  seuilAlerte: number;
};

export default function StockPage() {
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stock")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Stock production</h1>
            <p className="text-slate-500">Plaques en stock par site et type de produit</p>
          </div>
          <div className="flex gap-2">
            <Link href="/operator" className="btn-primary">
              Produire une plaque
            </Link>
            <Link href="/production/affectation" className="btn-secondary">
              Mettre à disposition
            </Link>
            <Link href="/production/stock/plaques" className="btn-secondary">
              Détails des plaques
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-slate-400">Chargement...</p>
        ) : data ? (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-4">
              <div className="card text-center">
                <p className="text-xs text-slate-500">Total plaques</p>
                <p className="text-2xl font-bold">{formatNombre(data.resume.total)}</p>
              </div>
              <div className="card text-center">
                <p className="text-xs text-slate-500">Stock production</p>
                <p className="text-2xl font-bold text-green-700">{formatNombre(data.resume.enStock)}</p>
              </div>
              <div className="card text-center">
                <p className="text-xs text-slate-500">Chez les vendeurs</p>
                <p className="text-2xl font-bold text-blue-700">{formatNombre(data.resume.affectees ?? 0)}</p>
              </div>
              <div className="card text-center">
                <p className="text-xs text-slate-500">Vendues</p>
                <p className="text-2xl font-bold text-slate-700">{formatNombre(data.resume.vendues)}</p>
              </div>
            </div>

            {data.alertes.length > 0 && (
              <div className="card mb-6 border-amber-200 bg-amber-50">
                <h2 className="mb-2 font-semibold text-amber-900">
                  Alertes stock (≤ {data.seuilAlerte} unités)
                </h2>
                <ul className="space-y-1 text-sm text-amber-800">
                  {data.alertes.map((a, i) => (
                    <li key={i}>
                      {a.site} — {a.type.replace("_", " ")} : <strong>{formatNombre(a.quantite)}</strong> restante(s)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card">
              <h2 className="mb-4 text-lg font-semibold">Détail du stock</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="pb-3 pr-4 font-medium">Site</th>
                      <th className="pb-3 pr-4 font-medium">Type produit</th>
                      <th className="pb-3 pr-4 font-medium">Quantité en stock</th>
                      <th className="pb-3 font-medium">Détails</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stock.map((s, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-3 pr-4 font-mono">{s.site}</td>
                        <td className="py-3 pr-4">{s.type}</td>
                        <td className="py-3">
                          <span className={`badge ${s.quantite <= data.seuilAlerte ? "badge-warning" : "badge-success"}`}>
                            {formatNombre(s.quantite)}
                          </span>
                        </td>
                        <td className="py-3">
                          <Link
                            href={`/production/stock/plaques?site=${encodeURIComponent(s.site)}${s.produitId ? `&produitId=${s.produitId}` : ""}&statut=EN_STOCK`}
                            className="text-sm font-medium text-red-600 hover:underline"
                          >
                            Détails
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {data.stock.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          Aucune plaque en stock.{" "}
                          <Link href="/operator" className="text-red-600 hover:underline">
                            Produire des plaques
                          </Link>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
