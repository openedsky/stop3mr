"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { APP_ROLES, ROLE_LABELS, AppRole } from "@/lib/roles";
import { nomComplet } from "@/lib/territoire";
import { formatNombre } from "@/lib/money";
import { PaginationBar, TableSearch, FilterField } from "@/components/PaginationBar";
import { Req } from "@/components/Req";
import { swalConfirm, swalError, swalSuccess, swalToast } from "@/lib/swal";

type Centre = { id: number; libelle: string; ville?: string | null };
type User = {
  id: number;
  identifiant: string;
  prenom: string | null;
  nom: string | null;
  codeCommercial: number | null;
  email: string | null;
  telephone: string | null;
  role: AppRole;
  actif: boolean;
  centreControleId: number | null;
  centreControle: { libelle: string } | null;
  _count: { ventesEnregistrees: number; plaquesAffectees: number; verifications: number };
};

const emptyForm = {
  identifiant: "",
  prenom: "",
  nom: "",
  email: "",
  telephone: "",
  role: "COMMERCIAL" as AppRole,
  centreControleId: "",
  actif: true,
};

export default function UtilisateursPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterActif, setFilterActif] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [centreQ, setCentreQ] = useState("");

  async function loadCentres(search = "") {
    const c = await fetch(`/api/admin/centres?q=${encodeURIComponent(search)}&limit=40`).then((r) => r.json());
    setCentres(c.centres ?? []);
  }

  async function load(p = page) {
    const params = new URLSearchParams({ page: String(p), limit: "40" });
    if (q) params.set("q", q);
    if (filterRole) params.set("role", filterRole);
    if (filterActif) params.set("actif", filterActif);
    const u = await fetch(`/api/admin/utilisateurs?${params}`).then((r) => r.json());
    setUsers(u.utilisateurs ?? []);
    setTotal(u.total ?? 0);
  }

  useEffect(() => {
    load(1);
    loadCentres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterRole, filterActif]);

  function startEdit(user: User) {
    setEditingId(user.id);
    setForm({
      identifiant: user.identifiant,
      prenom: user.prenom ?? "",
      nom: user.nom ?? "",
      email: user.email ?? "",
      telephone: user.telephone ?? "",
      role: user.role,
      centreControleId: user.centreControleId ? String(user.centreControleId) : "",
      actif: user.actif,
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function revealTemporaryPassword(userId: number | undefined, secretTemporaireId: string | undefined) {
    if (!userId || !secretTemporaireId) return "";
    const r = await fetch(`/api/admin/utilisateurs/${userId}/secret-temporaire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secretTemporaireId }),
    });
    if (!r.ok) return "";
    const payload = await r.json();
    return typeof payload.motDePasseTemporaire === "string" ? payload.motDePasseTemporaire : "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await swalConfirm(
      editingId ? "Enregistrer les modifications ?" : "Créer cet utilisateur ?",
      editingId
        ? "Les informations du compte vont être mises à jour."
        : `Un mot de passe temporaire sera affiché une seule fois.`,
      editingId ? "Enregistrer" : "Créer"
    );
    if (!ok) return;
    setSaving(true);
    setError("");
    const payload = {
      prenom: form.prenom,
      nom: form.nom,
      email: form.email,
      telephone: form.telephone,
      role: form.role,
      actif: form.actif,
      centreControleId:
        (form.role === "AGENT_CT" || form.role === "COMMERCIAL") && form.centreControleId
          ? Number(form.centreControleId)
          : null,
    };
    const res = editingId
      ? await fetch(`/api/admin/utilisateurs/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/admin/utilisateurs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, identifiant: form.identifiant }),
        });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      await swalError("Opération impossible", data.error ?? "Erreur");
      setError(data.error ?? "Erreur");
      return;
    }
    const temp = await revealTemporaryPassword(data.utilisateur?.id, data.secretTemporaireId);
    await swalSuccess(
      editingId ? "Utilisateur modifié" : "Utilisateur créé",
      temp
        ? `Mot de passe temporaire (à communiquer une fois) : ${temp}`
        : "L'opération a bien été enregistrée."
    );
    resetForm();
    load();
  }

  async function toggleActif(user: User) {
    const ok = await swalConfirm(
      user.actif ? "Désactiver ce compte ?" : "Réactiver ce compte ?",
      user.actif
        ? `${user.identifiant} ne pourra plus se connecter.`
        : `${user.identifiant} retrouvera l'accès à l'application.`,
      user.actif ? "Désactiver" : "Réactiver"
    );
    if (!ok) return;
    const res = await fetch(`/api/admin/utilisateurs/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !user.actif }),
    });
    if (!res.ok) {
      const d = await res.json();
      await swalError("Statut non modifié", d.error ?? "Impossible de changer le statut");
      return;
    }
    await swalToast("success", user.actif ? "Compte désactivé" : "Compte réactivé");
    load();
  }

  async function resetPassword(user: User) {
    const ok = await swalConfirm(
      "Réinitialiser le mot de passe ?",
      "Un mot de passe temporaire sera généré et affiché une seule fois.",
      "Réinitialiser"
    );
    if (!ok) return;
    const res = await fetch(`/api/admin/utilisateurs/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetMotDePasse: true }),
    });
    const d = await res.json();
    if (!res.ok) {
      await swalError("Réinitialisation impossible", d.error ?? "Erreur");
      return;
    }
    const temp = await revealTemporaryPassword(user.id, d.secretTemporaireId);
    await swalSuccess(
      "Mot de passe réinitialisé",
      temp
        ? `Mot de passe temporaire (à communiquer une fois) : ${temp}`
        : "Le mot de passe a été réinitialisé."
    );
  }

  async function removeUser(user: User) {
    const ok = await swalConfirm(
      "Supprimer définitivement ?",
      `${user.identifiant} sera supprimé. Un compte avec de l'activité devra être désactivé.`,
      "Supprimer"
    );
    if (!ok) return;
    const res = await fetch(`/api/admin/utilisateurs/${user.id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) {
      await swalError("Suppression impossible", d.error ?? "Suppression impossible");
      return;
    }
    await swalToast("success", "Utilisateur supprimé");
    load();
  }

  const needsCentre = form.role === "AGENT_CT" || form.role === "COMMERCIAL";

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link href="/admin" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Administration
        </Link>
        <h1 className="mb-2 text-2xl font-bold">Gestion des utilisateurs</h1>
        <p className="mb-6 text-slate-500">
          Ajout, modification, changement de rôle, désactivation et suppression. Un compte désactivé ne peut plus se
          connecter. À la création ou à la réinitialisation, un mot de passe temporaire unique s’affiche une seule fois.
        </p>
        {process.env.NODE_ENV !== "production" ? (
        <a href="/api/admin/comptes-test" className="btn-secondary mb-8 inline-flex !py-2 !text-xs">
          Télécharger les comptes test (CSV)
        </a>
        ) : null}

        <form onSubmit={handleSubmit} className="card mb-8 grid gap-4 sm:grid-cols-2">
          <h2 className="sm:col-span-2 text-lg font-semibold">
            {editingId ? `Modifier ${form.identifiant}` : "Nouvel utilisateur"}
          </h2>
          <div>
            <label className="mb-1 block text-sm">Identifiant<Req /></label>
            <input className="input-field" value={form.identifiant} onChange={(e) => setForm({ ...form, identifiant: e.target.value })} required disabled={!!editingId} />
            <p className="mt-1 text-xs text-slate-400">Un mot de passe temporaire sera généré à la création</p>
          </div>
          <div>
            <label className="mb-1 block text-sm">Prénom<Req /></label>
            <input className="input-field" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} required />
          </div>
          <div>
            <label className="mb-1 block text-sm">Nom<Req /></label>
            <input className="input-field" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required />
          </div>
          <div>
            <label className="mb-1 block text-sm">Rôle<Req /></label>
            <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}>
              {APP_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">Téléphone</label>
            <input className="input-field" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm">E-mail</label>
            <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          {needsCentre && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm">Centre de contrôle</label>
              <input
                className="input-field mb-2"
                placeholder="Filtrer les centres…"
                value={centreQ}
                onChange={(e) => {
                  setCentreQ(e.target.value);
                  loadCentres(e.target.value);
                }}
              />
              <select className="input-field" value={form.centreControleId} onChange={(e) => setForm({ ...form, centreControleId: e.target.value })}>
                <option value="">— Non assigné —</option>
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>{c.libelle}{c.ville ? ` (${c.ville})` : ""}</option>
                ))}
              </select>
            </div>
          )}
          {editingId && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.actif} onChange={(e) => setForm({ ...form, actif: e.target.checked })} />
              Compte actif (décochez pour bloquer l&apos;accès)
            </label>
          )}
          {error && <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Enregistrement..." : editingId ? "Enregistrer les modifications" : "Créer l'utilisateur"}
            </button>
            {editingId && (
              <>
                <button type="button" className="btn-secondary" onClick={resetForm}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const user = users.find((u) => u.id === editingId);
                    if (user) void resetPassword(user);
                  }}
                >
                  Réinitialiser le mot de passe
                </button>
              </>
            )}
          </div>
        </form>

        <div className="card overflow-x-auto">
          <TableSearch
            value={q}
            onChange={setQ}
            onSubmit={() => {
              setPage(1);
              load(1);
            }}
            placeholder="Recherche prénom, nom, identifiant…"
            filters={
              <>
                <FilterField label="Rôle">
                  <select
                    className="input-field"
                    value={filterRole}
                    onChange={(e) => {
                      setFilterRole(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Tous les rôles</option>
                    {APP_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Compte">
                  <select
                    className="input-field"
                    value={filterActif}
                    onChange={(e) => {
                      setFilterActif(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Tous</option>
                    <option value="true">Actifs</option>
                    <option value="false">Inactifs</option>
                  </select>
                </FilterField>
              </>
            }
          />
          <p className="mb-3 text-xs text-slate-400">{formatNombre(total)} compte(s)</p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-3 pr-4 font-medium">Identifiant</th>
                <th className="pb-3 pr-4 font-medium">Code</th>
                <th className="pb-3 pr-4 font-medium">Prénom / Nom</th>
                <th className="pb-3 pr-4 font-medium">Rôle</th>
                <th className="pb-3 pr-4 font-medium">Centre</th>
                <th className="pb-3 pr-4 font-medium">Activité</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={`border-b border-slate-100 ${u.actif ? "" : "opacity-60"}`}>
                  <td className="py-3 pr-4 font-mono text-xs">{u.identifiant}</td>
                  <td className="py-3 pr-4 font-mono text-xs">
                    {u.role === "COMMERCIAL" ? u.codeCommercial ?? "—" : "—"}
                  </td>
                  <td className="py-3 pr-4">{nomComplet(u)}</td>
                  <td className="py-3 pr-4">{ROLE_LABELS[u.role]}</td>
                  <td className="py-3 pr-4">{u.centreControle?.libelle ?? "—"}</td>
                  <td className="py-3 pr-4 text-xs text-slate-500">
                    {u.role === "COMMERCIAL" && `${formatNombre(u._count.ventesEnregistrees)} vente(s)`}
                    {u.role === "AGENT_CT" && `${formatNombre(u._count.verifications)} vérif.`}
                    {u.role === "OPERATEUR" && "Production"}
                    {u.role === "ADMINISTRATEUR" && "Admin"}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="btn-secondary !px-2 !py-1 !text-xs" onClick={() => startEdit(u)}>Modifier</button>
                      <button type="button" className={`badge ${u.actif ? "badge-success" : "badge-warning"}`} onClick={() => toggleActif(u)}>
                        {u.actif ? "Actif" : "Inactif"}
                      </button>
                      <button type="button" className="btn-secondary !px-2 !py-1 !text-xs" onClick={() => resetPassword(u)}>
                        MDP
                      </button>
                      <button type="button" className="btn-secondary !px-2 !py-1 !text-xs !text-red-700" onClick={() => removeUser(u)}>
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar
            page={page}
            pages={Math.max(1, Math.ceil(total / 40))}
            total={total}
            onPage={(p) => {
              setPage(p);
              load(p);
            }}
            label="compte"
          />
        </div>
      </main>
    </div>
  );
}
