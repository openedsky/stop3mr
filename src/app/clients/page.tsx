"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { ClientSituationCard } from "@/components/ClientSituationCard";
import { PaginationBar, TableSearch, FilterField } from "@/components/PaginationBar";
import { TYPE_CLIENT_LABELS, FNE_STATUT_LABELS } from "@/lib/clients";

type Client = {
  id: number;
  typeClient: string;
  nom: string;
  telephone: string;
  email: string | null;
  vehiculesSummary?: string;
  ville: string | null;
  fneStatut: string;
  _count: { ventes: number };
  creeLe: string;
};

type Situation = {
  totalFacture: number;
  totalPaye: number;
  soldeDu: number;
  facturesImpayees: number;
  nbVentes: number;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [situation, setSituation] = useState<Situation | null>(null);
  const [q, setQ] = useState("");
  const [typeClient, setTypeClient] = useState("");
  const [fneStatut, setFneStatut] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  async function load(search = q, p = page, type = typeClient, fne = fneStatut) {
    setLoading(true);
    const params = new URLSearchParams({ q: search, page: String(p), limit: "20" });
    if (type) params.set("typeClient", type);
    if (fne) params.set("fneStatut", fne);
    const res = await fetch(`/api/clients?${params}`);
    if (res.ok) {
      const data = await res.json();
      setClients(data.clients);
      setPages(data.pagination?.pages ?? 1);
      setTotal(data.pagination?.total ?? 0);
    }
    setLoading(false);
  }

  useEffect(() => {
    load(q, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (!selectedId) {
      setSituation(null);
      return;
    }
    fetch(`/api/crm/situation/${selectedId}`)
      .then((r) => r.json())
      .then((d) => setSituation(d.situation))
      .catch(() => setSituation(null));
  }, [selectedId]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
            <p className="text-slate-500">Gestion du répertoire clients — réutilisable lors des ventes</p>
          </div>
          <Link href="/clients/nouveau" className="btn-primary">
            Nouveau client
          </Link>
        </div>

        <div className="card mb-6">
          <TableSearch
            value={q}
            onChange={setQ}
            onSubmit={() => {
              setPage(1);
              load(q, 1, typeClient, fneStatut);
            }}
            placeholder="Rechercher par nom, téléphone, immatriculation, NCC..."
            filters={
              <>
                <FilterField label="Type">
                  <select
                    className="input-field"
                    value={typeClient}
                    onChange={(e) => {
                      setTypeClient(e.target.value);
                      setPage(1);
                      load(q, 1, e.target.value, fneStatut);
                    }}
                  >
                    <option value="">Tous</option>
                    {Object.entries(TYPE_CLIENT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="FNE">
                  <select
                    className="input-field"
                    value={fneStatut}
                    onChange={(e) => {
                      setFneStatut(e.target.value);
                      setPage(1);
                      load(q, 1, typeClient, e.target.value);
                    }}
                  >
                    <option value="">Tous</option>
                    {Object.entries(FNE_STATUT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </>
            }
          />
        </div>

        {selectedId && situation && (
          <div className="mb-6">
            <ClientSituationCard situation={situation} />
          </div>
        )}

        <div className="card">
          {loading ? (
            <p className="py-8 text-center text-slate-400">Chargement...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Nom</th>
                    <th className="pb-3 pr-4 font-medium">Type</th>
                    <th className="pb-3 pr-4 font-medium">Téléphone</th>
                    <th className="pb-3 pr-4 font-medium">Véhicules</th>
                    <th className="pb-3 pr-4 font-medium">FNE</th>
                    <th className="pb-3 pr-4 font-medium">Ventes</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr
                      key={c.id}
                      className={`border-b border-slate-100 ${selectedId === c.id ? "bg-red-50/50" : ""}`}
                    >
                      <td className="py-3 pr-4 font-medium">{c.nom}</td>
                      <td className="py-3 pr-4 text-xs">{TYPE_CLIENT_LABELS[c.typeClient] ?? c.typeClient}</td>
                      <td className="py-3 pr-4">{c.telephone}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{c.vehiculesSummary ?? "—"}</td>
                      <td className="py-3 pr-4 text-xs">{FNE_STATUT_LABELS[c.fneStatut] ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <span className="badge badge-info">{c._count.ventes}</span>
                      </td>
                      <td className="py-3 space-x-2">
                        <button
                          type="button"
                          onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                          className="text-sm font-medium text-slate-600 hover:underline"
                        >
                          Situation
                        </button>
                        <Link
                          href={`/clients/${c.id}`}
                          className="text-sm font-medium text-red-600 hover:underline"
                        >
                          Voir
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {clients.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Aucun client.{" "}
                        <Link href="/clients/nouveau" className="text-red-600 hover:underline">
                          Ajouter le premier
                        </Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <PaginationBar page={page} pages={pages} total={total} onPage={setPage} label="client" />
        </div>
      </main>
    </div>
  );
}
