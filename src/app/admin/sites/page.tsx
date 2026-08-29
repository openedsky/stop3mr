"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { swalConfirm, swalError, swalSuccess } from "@/lib/swal";
import { Req } from "@/components/Req";

type Site = {
  id: number;
  code: string;
  libelle: string;
  pays: string;
  ville: string | null;
  commune: string | null;
  quartier: string | null;
  adresse: string | null;
  latitude: number | null;
  longitude: number | null;
  actif: boolean;
};

const empty = {
  code: "YP",
  libelle: "Usine Stop 3MR — Yopougon",
  pays: "Côte d'Ivoire",
  ville: "Abidjan",
  commune: "Yopougon",
  quartier: "",
  adresse: "",
  latitude: "",
  longitude: "",
};

export default function AdminSitesPage() {
  const { data: session } = useSession();
  const [sites, setSites] = useState<Site[]>([]);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/sites");
    if (res.ok) {
      const data = await res.json();
      setSites(data.sites);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await swalConfirm("Enregistrer ce site de production ?", form.libelle || form.code, "Enregistrer");
    if (!ok) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      await swalError("Site non enregistré", d.error ?? "Erreur");
      setError(d.error ?? "Erreur");
      return;
    }
    await swalSuccess("Site enregistré");
    setForm(empty);
    load();
  }

  if (session?.user.role !== "ADMINISTRATEUR") {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-8">Accès réservé aux administrateurs.</main>
      </div>
    );
  }

  const actifs = sites.filter((s) => s.actif);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/admin" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Administration
        </Link>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Sites de production</h1>
          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">Usine</span>
        </div>
        <p className="mb-4 text-slate-500">
          Lieu de confection des plaques (QR, stock usine). Distinct des centres de contrôle technique où se font les
          ventes et vérifications.
        </p>
        <div className="mb-8 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          Configuration actuelle : <strong>une seule usine à Abidjan — Yopougon</strong>. Les ~1000 points de vente /
          contrôle sont gérés dans{" "}
          <Link href="/admin/centres" className="font-semibold underline">
            Centres de contrôle
          </Link>
          .
        </div>

        {sites.length === 0 && (
        <form onSubmit={handleSubmit} className="card mb-8 space-y-4">
          <h2 className="text-lg font-semibold">Ajouter une usine</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Code<Req /></label>
              <input className="input-field uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={10} required />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Libellé<Req /></label>
              <input className="input-field" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Pays</label>
              <input className="input-field" value={form.pays} onChange={(e) => setForm({ ...form, pays: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ville</label>
              <input className="input-field" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Commune</label>
              <input className="input-field" value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Quartier</label>
              <input className="input-field" value={form.quartier} onChange={(e) => setForm({ ...form, quartier: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Adresse</label>
              <input className="input-field" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Latitude</label>
              <input className="input-field font-mono" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Longitude</label>
              <input className="input-field font-mono" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            </div>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Ajout..." : "Ajouter l'usine"}
          </button>
        </form>
        )}

        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Usines enregistrées</h2>
          {loading ? (
            <p className="text-slate-400">Chargement...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Code</th>
                    <th className="pb-3 pr-4 font-medium">Usine</th>
                    <th className="pb-3 pr-4 font-medium">Localisation</th>
                    <th className="pb-3 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-mono font-bold">{s.code}</td>
                      <td className="py-3 pr-4">
                        <p>{s.libelle}</p>
                        <p className="text-xs text-slate-400">{s.adresse}</p>
                      </td>
                      <td className="py-3 pr-4">
                        {[s.quartier, s.commune, s.ville].filter(Boolean).join(" · ")}
                        {s.latitude != null && s.longitude != null && (
                          <p className="font-mono text-xs text-slate-400">
                            {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
                          </p>
                        )}
                      </td>
                      <td className="py-3">
                        <span className={`badge ${s.actif ? "badge-success" : "badge-warning"}`}>{s.actif ? "Active" : "Inactive"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {actifs.length !== 1 && (
            <p className="mt-3 text-xs text-amber-700">Une seule usine active est attendue (Yopougon). Désactivez les autres.</p>
          )}
        </div>
      </main>
    </div>
  );
}
