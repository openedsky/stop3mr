"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { formatNombre } from "@/lib/money";

type Item = { produit: string; code: string; quantite: number };
type Data = {
  resume: { affectees: number; vendues: number };
  stockVendeur: Item[];
};

export default function StockVendeurPage() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/stock")
      .then((r) => r.json())
      .then(setData);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Mon stock vendeur</h1>
            <p className="text-slate-500">Plaques mises à votre disposition par les unités de production.</p>
          </div>
          <Link href="/ventes/nouvelle" className="btn-primary">
            Enregistrer une vente
          </Link>
        </div>

        {!data ? (
          <p className="text-slate-400">Chargement...</p>
        ) : (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2">
              <div className="card">
                <p className="text-sm text-slate-500">Disponibles à la vente</p>
                <p className="text-3xl font-bold text-amber-600">{formatNombre(data.resume.affectees)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500">Déjà vendues</p>
                <p className="text-3xl font-bold text-green-700">{formatNombre(data.resume.vendues)}</p>
              </div>
            </div>
            <div className="card">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-3 font-medium">Produit</th>
                    <th className="pb-3 font-medium">Code</th>
                    <th className="pb-3 font-medium">Quantité</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.stockVendeur ?? []).map((s) => (
                    <tr key={s.code + s.produit} className="border-b border-slate-100">
                      <td className="py-3 pr-4">{s.produit}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{s.code}</td>
                      <td className="py-3">
                        <span className="badge badge-info">{formatNombre(s.quantite)}</span>
                      </td>
                    </tr>
                  ))}
                  {(data.stockVendeur ?? []).length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400">
                        Aucun stock affecté pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
