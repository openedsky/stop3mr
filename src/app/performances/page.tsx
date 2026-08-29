"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { formatFcfa, formatNombre } from "@/lib/money";
import { swalError } from "@/lib/swal";
import { AppRole } from "@/lib/roles";

type Perf = {
  scope?: "global" | "utilisateur";
  periode: { from: string; to: string; label: string };
  totaux: {
    ventes: number;
    chiffreAffaires: number;
    commission: number;
    ventesDirectes?: number;
    chiffreAffairesDirect?: number;
    commissionControle: number;
    verifications: number;
    authentiques: number;
    inconnues: number;
    contrefaites: number;
  };
  evolution: Array<{ periode: string; ventes: number; ca: number; controles: number }>;
  vendeurs: Array<{ id: number; nom: string; identifiant: string; ventes: number; chiffreAffaires: number; commission: number }>;
  agents: Array<{ id: number; nom: string; identifiant: string; verifications: number; commission: number }>;
  centres: Array<{ id: number; libelle: string; ville: string; ventes: number; chiffreAffaires: number; verifications: number }>;
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function PerformancesPage() {
  const { data: session } = useSession();
  const role = session?.user.role as AppRole | undefined;
  const [mode, setMode] = useState<"mois" | "plage">("mois");
  const [mois, setMois] = useState(currentMonth());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Perf | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    if (mode === "plage" && from && to) return `from=${from}&to=${to}`;
    return `mois=${mois}`;
  }, [mode, mois, from, to]);

  async function load(q = query) {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/performances?${q}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      const message = json.error ?? "Impossible de charger les statistiques";
      setError(message);
      await swalError("Statistiques indisponibles", message);
      return;
    }
    setData(json);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    load(query);
  }

  const titre =
    role === "COMMERCIAL"
      ? "Mes performances de vente"
      : role === "AGENT_CT"
        ? "Mes performances de contrôle"
        : "Statistiques de performance";
  const isAdmin = role === "ADMINISTRATEUR";
  const showVentes = isAdmin || role === "COMMERCIAL";
  const showControles = isAdmin || role === "AGENT_CT";

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold">{titre}</h1>
        <p className="mb-6 text-slate-500">
          {isAdmin
            ? "Vue globale : ventes, commissions, contrôles, agents, vendeurs et centres."
            : "Uniquement vos activités sur la période sélectionnée."}
        </p>

        <form onSubmit={handleSubmit} className="card mb-8">
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={mode === "mois" ? "btn-primary !py-1.5 !text-xs" : "btn-secondary !py-1.5 !text-xs"}
              onClick={() => setMode("mois")}
            >
              Mois
            </button>
            <button
              type="button"
              className={mode === "plage" ? "btn-primary !py-1.5 !text-xs" : "btn-secondary !py-1.5 !text-xs"}
              onClick={() => setMode("plage")}
            >
              Entre deux dates
            </button>
          </div>
          {mode === "mois" ? (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-sm">Mois</label>
                <input className="input-field" type="month" value={mois} onChange={(e) => setMois(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary">
                Afficher
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-sm">Du</label>
                <input className="input-field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required={mode === "plage"} />
              </div>
              <div>
                <label className="mb-1 block text-sm">Au</label>
                <input className="input-field" type="date" value={to} onChange={(e) => setTo(e.target.value)} required={mode === "plage"} />
              </div>
              <button type="submit" className="btn-primary">
                Afficher
              </button>
            </div>
          )}
        </form>

        {error && <p className="mb-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {loading && <p className="text-slate-400">Chargement...</p>}

        {data && !loading && (
          <>
            <p className="mb-4 text-sm text-slate-500">Période : {data.periode.label}</p>
            <div className={`mb-8 grid gap-4 sm:grid-cols-2 ${isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
              {showVentes && (
                <>
                  <div className="card">
                    <p className="text-sm text-slate-500">{isAdmin ? "Ventes" : "Mes ventes"}</p>
                    <p className="text-2xl font-bold">{formatNombre(data.totaux.ventes)}</p>
                  </div>
                  <div className="card">
                    <p className="text-sm text-slate-500">Chiffre d&apos;affaires</p>
                    <p className="text-2xl font-bold">{formatFcfa(data.totaux.chiffreAffaires)}</p>
                  </div>
                  <div className="card">
                    <p className="text-sm text-slate-500">Commissions</p>
                    <p className="text-2xl font-bold text-green-700">{formatFcfa(data.totaux.commission)}</p>
                  </div>
                  {isAdmin && (
                    <div className="card">
                      <p className="text-sm text-slate-500">Ventes directes</p>
                      <p className="text-2xl font-bold">{formatNombre(data.totaux.ventesDirectes ?? 0)}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatFcfa(data.totaux.chiffreAffairesDirect ?? 0)} sans commission
                      </p>
                    </div>
                  )}
                </>
              )}
              {showControles && (
                <>
                  <div className="card">
                    <p className="text-sm text-slate-500">{isAdmin ? "Contrôles" : "Mes contrôles"}</p>
                    <p className="text-2xl font-bold">{formatNombre(data.totaux.verifications)}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatNombre(data.totaux.authentiques)} authentiques · {formatNombre(data.totaux.contrefaites)} contrefaites
                    </p>
                  </div>
                  <div className="card">
                    <p className="text-sm text-slate-500">Commissions contrôle</p>
                    <p className="text-2xl font-bold text-green-700">{formatFcfa(data.totaux.commissionControle ?? 0)}</p>
                  </div>
                </>
              )}
            </div>

            {data.evolution.length > 0 && (
              <div className="card mb-8 overflow-x-auto">
                <h2 className="mb-4 text-lg font-semibold">Évolution mensuelle</h2>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="pb-2 font-medium">Mois</th>
                      {showVentes && (
                        <>
                          <th className="pb-2 font-medium">Ventes</th>
                          <th className="pb-2 font-medium">CA</th>
                        </>
                      )}
                      {showControles && <th className="pb-2 font-medium">Contrôles</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.evolution.map((e) => (
                      <tr key={e.periode} className="border-b border-slate-100">
                        <td className="py-2 pr-4 font-mono text-xs">{e.periode}</td>
                        {showVentes && (
                          <>
                            <td className="py-2 pr-4">{formatNombre(e.ventes)}</td>
                            <td className="py-2 pr-4">{formatFcfa(e.ca)}</td>
                          </>
                        )}
                        {showControles && <td className="py-2">{formatNombre(e.controles)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isAdmin && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="card overflow-x-auto">
                  <h2 className="mb-4 text-lg font-semibold">Vendeurs</h2>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="pb-2 font-medium">Vendeur</th>
                        <th className="pb-2 font-medium">Ventes</th>
                        <th className="pb-2 font-medium">CA</th>
                        <th className="pb-2 font-medium">Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.vendeurs.map((v) => (
                        <tr key={v.id} className="border-b border-slate-100">
                          <td className="py-2 pr-4">
                            <p className="font-medium">{v.nom}</p>
                            <p className="font-mono text-[11px] text-slate-400">{v.identifiant}</p>
                          </td>
                          <td className="py-2 pr-4">{formatNombre(v.ventes)}</td>
                          <td className="py-2 pr-4">{formatFcfa(v.chiffreAffaires)}</td>
                          <td className="py-2">{formatFcfa(v.commission)}</td>
                        </tr>
                      ))}
                      {data.vendeurs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-slate-400">
                            Aucune vente sur cette période.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="card overflow-x-auto">
                  <h2 className="mb-4 text-lg font-semibold">Agents de contrôle</h2>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="pb-2 font-medium">Agent</th>
                        <th className="pb-2 font-medium">Vérifications</th>
                        <th className="pb-2 font-medium">Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.agents.map((a) => (
                        <tr key={a.id} className="border-b border-slate-100">
                          <td className="py-2 pr-4">
                            <p className="font-medium">{a.nom}</p>
                            <p className="font-mono text-[11px] text-slate-400">{a.identifiant}</p>
                          </td>
                          <td className="py-2 pr-4">{formatNombre(a.verifications)}</td>
                          <td className="py-2">{formatFcfa(a.commission ?? 0)}</td>
                        </tr>
                      ))}
                      {data.agents.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-6 text-slate-400">
                            Aucun contrôle sur cette période.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="card mt-6 overflow-x-auto">
              <h2 className="mb-4 text-lg font-semibold">
                {isAdmin ? "Centres de contrôle" : "Mes centres"}
              </h2>
              <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="pb-2 font-medium">Centre</th>
                      {showVentes && (
                        <>
                          <th className="pb-2 font-medium">Ventes</th>
                          <th className="pb-2 font-medium">CA</th>
                        </>
                      )}
                      {showControles && <th className="pb-2 font-medium">Contrôles</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.centres.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100">
                        <td className="py-2 pr-4">
                          {c.libelle}
                          {c.ville ? <span className="text-slate-400"> · {c.ville}</span> : null}
                        </td>
                        {showVentes && (
                          <>
                            <td className="py-2 pr-4">{formatNombre(c.ventes)}</td>
                            <td className="py-2 pr-4">{formatFcfa(c.chiffreAffaires)}</td>
                          </>
                        )}
                        {showControles && <td className="py-2">{formatNombre(c.verifications)}</td>}
                      </tr>
                    ))}
                    {data.centres.length === 0 && (
                      <tr>
                        <td colSpan={isAdmin ? 4 : 3} className="py-6 text-slate-400">
                          Aucune activité centre sur cette période.
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
