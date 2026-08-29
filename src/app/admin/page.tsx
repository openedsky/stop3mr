"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { formatFcfa, formatNombre } from "@/lib/money";
import { swalConfirm } from "@/lib/swal";

type Stats = {
  stats: {
    totalPlaques: number;
    enStock: number;
    vendues: number;
    tauxVente: number;
    plaquesExpirees?: number;
    plaquesExpireBientot?: number;
    commissionsVentesDue?: number;
    commissionsControlesDue?: number;
    ventesDirectes?: number;
  };
  ventesRecentes: Array<{
    id: number;
    dateVente: string;
    plaque: { numeroSerie: string; typeProduit: string };
    client: { nom: string; immatriculation?: string };
    vehiculeImmat?: string;
  }>;
  auditRecent: Array<{
    id: number;
    action: string;
    cible: string | null;
    horodatage: string;
    utilisateur: { identifiant: string } | null;
  }>;
};

export default function AdminPage() {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  async function handleExport(format: "xlsx" | "csv") {
    const ok = await swalConfirm(
      "Exporter les données ?",
      format === "xlsx" ? "Un fichier Excel va être téléchargé." : "Un fichier CSV va être téléchargé.",
      "Exporter"
    );
    if (!ok) return;
    window.open(`/api/export?format=${format}`, "_blank");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8">Chargement...</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Administration</h1>
            <p className="text-slate-500">Supervision, statistiques et export</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleExport("xlsx")} className="btn-primary">
              Export Excel (.xlsx)
            </button>
            <button onClick={() => handleExport("csv")} className="btn-secondary">
              Export CSV
            </button>
            <a href="/admin/historique" className="btn-secondary">
              Historique global
            </a>
            <a href="/ventes/nouvelle?canal=DIRECTE" className="btn-secondary">
              Vente directe
            </a>
            <a href="/admin/paiements-commissions" className="btn-secondary">
              Payer les commissions
            </a>
            <a href="/admin/expirations" className="btn-secondary">
              Plaques expirées
            </a>
            <a href="/performances" className="btn-secondary">
              Performances
            </a>
            <a href="/rapports" className="btn-secondary">
              Rapports
            </a>
          </div>
        </div>

        {data && (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-4">
              <div className="card">
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-2xl font-bold">{formatNombre(data.stats.totalPlaques)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500">En stock</p>
                <p className="text-2xl font-bold text-amber-600">{formatNombre(data.stats.enStock)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500">Vendues</p>
                <p className="text-2xl font-bold text-green-600">{formatNombre(data.stats.vendues)}</p>
                <p className="mt-1 text-xs text-slate-400">
                  dont {formatNombre(data.stats.ventesDirectes ?? 0)} directe(s)
                </p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500">Taux de vente</p>
                <p className="text-2xl font-bold text-blue-600">{data.stats.tauxVente}%</p>
              </div>
            </div>

            <div className="mb-8 grid gap-4 sm:grid-cols-4">
              <a href="/admin/expirations" className="card">
                <p className="text-sm text-slate-500">Plaques expirées</p>
                <p className="text-2xl font-bold text-red-700">{formatNombre(data.stats.plaquesExpirees ?? 0)}</p>
              </a>
              <a href="/admin/expirations" className="card">
                <p className="text-sm text-slate-500">Expiration proche</p>
                <p className="text-2xl font-bold text-amber-600">{formatNombre(data.stats.plaquesExpireBientot ?? 0)}</p>
              </a>
              <a href="/admin/paiements-commissions" className="card">
                <p className="text-sm text-slate-500">Comm. commerciaux dues</p>
                <p className="text-2xl font-bold text-amber-700">{formatFcfa(data.stats.commissionsVentesDue ?? 0)}</p>
              </a>
              <a href="/admin/paiements-commissions" className="card">
                <p className="text-sm text-slate-500">Comm. contrôleurs dues</p>
                <p className="text-2xl font-bold text-amber-700">{formatFcfa(data.stats.commissionsControlesDue ?? 0)}</p>
              </a>
            </div>

            <div className="card mb-8">
              <p className="text-sm text-slate-500">Compte contribuable</p>
              <p className="font-mono text-lg">{process.env.NEXT_PUBLIC_COMPTE_CONTRIBUABLE ?? "CI-XXXXX"}</p>
              <p className="mt-2 text-sm text-slate-500">
                Prix de référence : <strong>3 000 F CFA</strong> par plaque
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="card">
                <h2 className="mb-4 text-lg font-semibold">Ventes récentes</h2>
                <div className="space-y-3">
                  {data.ventesRecentes.map((v) => (
                    <div key={v.id} className="rounded-lg border border-slate-100 p-3">
                      <p className="font-mono text-xs text-slate-600">{v.plaque.numeroSerie}</p>
                      <p className="text-sm">
                        {v.vehiculeImmat ?? v.client.immatriculation ?? "—"} — {new Date(v.dateVente).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  ))}
                  {data.ventesRecentes.length === 0 && (
                    <p className="text-sm text-slate-400">Aucune vente enregistrée</p>
                  )}
                </div>
              </div>

              <div className="card">
                <h2 className="mb-4 text-lg font-semibold">Journal d&apos;audit</h2>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {data.auditRecent.map((a) => (
                    <div key={a.id} className="rounded border border-slate-100 px-3 py-2 text-sm">
                      <span className="font-medium text-red-700">{a.action}</span>
                      {a.cible && <span className="text-slate-500"> — {a.cible}</span>}
                      <br />
                      <span className="text-xs text-slate-400">
                        {a.utilisateur?.identifiant ?? "Système"} ·{" "}
                        {new Date(a.horodatage).toLocaleString("fr-FR")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
