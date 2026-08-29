"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { AuditTable } from "@/components/AuditTable";
import { PaginationBar, TableSearch, FilterField } from "@/components/PaginationBar";
import { AUDIT_LABELS } from "@/lib/clients";

type AuditEntry = {
  id: number;
  action: string;
  actionLabel: string;
  cible: string | null;
  details: string | null;
  horodatage: string;
  adresseIp: string | null;
};

export default function ProfileHistoryPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");

  function load(p = page, search = q, act = action) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "30" });
    if (search) params.set("q", search);
    if (act) params.set("action", act);
    fetch(`/api/audit?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries);
        setTotalPages(d.pagination.pages);
        setTotal(d.pagination.total ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link href="/profile" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Mon profil
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Mon historique d&apos;activité</h1>
        <p className="mb-6 text-slate-500">
          Connexions, créations, modifications et ventes que vous avez effectuées
        </p>

        <div className="card">
          <TableSearch
            value={q}
            onChange={setQ}
            onSubmit={() => {
              setPage(1);
              load(1, q, action);
            }}
            placeholder="Rechercher une cible, une action…"
            filters={
              <FilterField label="Action">
                <select
                  className="input-field"
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value);
                    setPage(1);
                    load(1, q, e.target.value);
                  }}
                >
                  <option value="">Toutes</option>
                  {Object.entries(AUDIT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </FilterField>
            }
          />
          {loading ? (
            <p className="py-8 text-center text-slate-400">Chargement...</p>
          ) : (
            <>
              <AuditTable entries={entries} />
              <PaginationBar page={page} pages={totalPages} total={total} onPage={setPage} label="événement" />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
