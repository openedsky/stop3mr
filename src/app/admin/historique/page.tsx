"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { AuditTable } from "@/components/AuditTable";

type AuditEntry = {
  id: number;
  action: string;
  actionLabel: string;
  cible: string | null;
  details: string | null;
  horodatage: string;
  adresseIp: string | null;
  utilisateur: { identifiant: string; nom: string | null; role: string } | null;
};

type Utilisateur = {
  id: number;
  identifiant: string;
  nom: string | null;
  role: string;
};

export default function AdminHistoryPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [utilisateurId, setUtilisateurId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  function buildUrl(p: number) {
    const params = new URLSearchParams({ page: String(p) });
    if (utilisateurId) params.set("utilisateurId", utilisateurId);
    if (action) params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q) params.set("q", q);
    return `/api/admin/audit?${params}`;
  }

  function load(p = page) {
    setLoading(true);
    fetch(buildUrl(p))
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries);
        setUtilisateurs(d.utilisateurs);
        setTotalPages(d.pagination.pages);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setLoading(true);
    fetch(buildUrl(page))
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries);
        setUtilisateurs(d.utilisateurs);
        setTotalPages(d.pagination.pages);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function handleFilter(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    load(1);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link href="/admin" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Administration
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Historique global</h1>
        <p className="mb-6 text-slate-500">
          Toutes les opérations. Les modifications de prix ou de commission affichent l&apos;ancienne et la nouvelle
          valeur. Les ventes déjà enregistrées ne sont pas recalculées.
        </p>

        <div className="card mb-6">
          <form onSubmit={handleFilter} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Utilisateur</label>
              <select
                className="input-field"
                value={utilisateurId}
                onChange={(e) => setUtilisateurId(e.target.value)}
              >
                <option value="">Tous</option>
                {utilisateurs.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.identifiant} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Action</label>
              <select className="input-field" value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">Toutes</option>
                <option value="CONNEXION">Connexion</option>
                <option value="PLAQUE_CREEE">Plaque créée</option>
                <option value="CLIENT_CREE">Client créé</option>
                <option value="CLIENT_MODIFIE">Client modifié</option>
                <option value="CLIENT_SUPPRIME">Client supprimé</option>
                <option value="VENTE_ENREGISTREE">Vente enregistrée</option>
                <option value="PROFIL_MODIFIE">Profil modifié</option>
                <option value="MOT_DE_PASSE_MODIFIE">Mot de passe modifié</option>
                <option value="EXPORT_DONNEES">Export</option>
                <option value="FACTURE_CREEE">Facture créée</option>
                <option value="RECU_CREE">Reçu créé</option>
                <option value="PARAMETRES_MODIFIES">Paramètres QR</option>
                <option value="PARAMETRES_METIER">Paramètres métier / commissions</option>
                <option value="PRODUIT_CREE">Produit créé</option>
                <option value="PRODUIT_MODIFIE">Produit / tarif modifié</option>
                <option value="COMMISSION_PAYEE">Commission payée</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Du</label>
              <input
                className="input-field"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Au</label>
              <input className="input-field" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="mb-1 block text-xs font-medium text-slate-500">Recherche</label>
              <input
                className="input-field"
                placeholder="Cible, action, détails…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <button type="submit" className="btn-primary">
                Filtrer
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          {loading ? (
            <p className="py-8 text-center text-slate-400">Chargement...</p>
          ) : (
            <>
              <AuditTable entries={entries} showUser />
              {totalPages > 1 && (
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    className="btn-secondary !py-1 !text-xs"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Précédent
                  </button>
                  <span className="px-3 py-1 text-sm text-slate-500">
                    Page {page} / {totalPages}
                  </span>
                  <button
                    className="btn-secondary !py-1 !text-xs"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Suivant
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
