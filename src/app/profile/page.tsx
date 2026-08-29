"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { CentreSelect, type CentreOption } from "@/components/CentreSelect";
import { Req } from "@/components/Req";
import { swalConfirm, swalError, swalSuccess } from "@/lib/swal";

type UserProfile = {
  id: number;
  identifiant: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  role: string;
  creeLe: string;
  centreControle?: CentreOption | null;
};

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [centreId, setCentreId] = useState("");
  const [centreHabituel, setCentreHabituel] = useState<CentreOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user);
        setPrenom(d.user.prenom ?? "");
        setNom(d.user.nom ?? "");
        setEmail(d.user.email ?? "");
        if (d.user.centreControle) {
          setCentreHabituel(d.user.centreControle);
          setCentreId(String(d.user.centreControle.id));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await swalConfirm("Enregistrer le profil ?", "Vos informations personnelles vont être mises à jour.", "Enregistrer");
    if (!ok) return;
    setSaving(true);
    setError("");
    setMessage("");

    const payload: Record<string, unknown> = { prenom, nom, email };
    if (user?.role === "COMMERCIAL" || user?.role === "AGENT_CT") {
      payload.centreControleId = centreId ? Number(centreId) : null;
    }
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      await swalError("Modification impossible", data.error ?? "Erreur");
      setError(data.error ?? "Erreur");
      return;
    }

    const { user: updated } = await res.json();
    setUser(updated);
    setMessage("Profil mis à jour.");
    await swalSuccess("Profil enregistré", "Vos informations ont été mises à jour.");
    await update();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-lg px-4 py-8">Chargement...</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Mon profil</h1>
        <p className="mb-6 text-slate-500">{session?.user.identifiant} — {user?.role}</p>

        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <Link href="/profile/mot-de-passe" className="card hover:border-red-200 hover:shadow-md transition">
            <p className="font-semibold text-slate-900">Mot de passe</p>
            <p className="text-sm text-slate-500">Modifier votre mot de passe</p>
          </Link>
          <Link href="/profile/historique" className="card hover:border-red-200 hover:shadow-md transition">
            <p className="font-semibold text-slate-900">Mon historique</p>
            <p className="text-sm text-slate-500">Vos opérations et connexions</p>
          </Link>
        </div>

        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Informations personnelles</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-500">Identifiant</label>
              <input className="input-field bg-slate-50" value={user?.identifiant ?? ""} disabled />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Prénom<Req /></label>
              <input className="input-field" value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Nom<Req /></label>
              <input className="input-field" value={nom} onChange={(e) => setNom(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">E-mail</label>
              <input
                className="input-field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {(user?.role === "COMMERCIAL" || user?.role === "AGENT_CT") && (
              <div>
                <label className="mb-1 block text-sm font-medium">Centre de contrôle habituel</label>
                <CentreSelect
                  value={centreId}
                  onChange={(id, centre) => {
                    setCentreId(id);
                    if (centre) setCentreHabituel(centre);
                  }}
                  initialCentre={centreHabituel}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Pré-rempli lors de l&apos;enregistrement d&apos;une vente. Vous pouvez le changer à chaque vente.
                </p>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-500">Membre depuis</label>
              <p className="text-sm text-slate-600">
                {user?.creeLe ? new Date(user.creeLe).toLocaleDateString("fr-FR") : "—"}
              </p>
            </div>

            {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
