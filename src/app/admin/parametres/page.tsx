"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { swalConfirm, swalError, swalSuccess } from "@/lib/swal";
import { Req } from "@/components/Req";

type QrSettings = {
  environment: "localhost" | "production";
  urlLocalhost: string;
  urlProduction: string;
  verifyPath: string;
};

export default function ParametresPage() {
  const [settings, setSettings] = useState<QrSettings | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewQr, setPreviewQr] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [regenerateAll, setRegenerateAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    fetch("/api/settings/qr")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d.settings);
        setPreviewUrl(d.previewUrl);
        setPreviewQr(d.previewQr);
        setCanEdit(d.canEdit);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!settings || !canEdit) return;
    const ok = await swalConfirm(
      "Enregistrer les paramètres QR ?",
      regenerateAll ? "Tous les QR codes existants seront régénérés." : "Les nouveaux QR codes utiliseront ces URL.",
      "Enregistrer"
    );
    if (!ok) return;
    setSaving(true);
    setError("");
    setMessage("");

    const res = await fetch("/api/settings/qr", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...settings, regenerateAll }),
    });

    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      await swalError("Paramètres non enregistrés", d.error ?? "Erreur");
      setError(d.error ?? "Erreur");
      return;
    }

    const d = await res.json();
    setSettings(d.settings);
    setPreviewUrl(d.previewUrl);
    setPreviewQr(d.previewQr);
    const msg = d.regenerated
      ? `Paramètres enregistrés. ${d.regenerated} QR code(s) régénéré(s).`
      : "Paramètres enregistrés.";
    setMessage(msg);
    await swalSuccess("Paramètres enregistrés", msg);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-8">Chargement...</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/admin" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Administration
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Paramètres QR Code</h1>
        <p className="mb-6 text-slate-500">
          Configurez la chaîne d&apos;URL encodée dans les QR codes (localhost ou production)
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleSubmit} className="card space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Environnement actif<Req /></label>
              <select
                className="input-field"
                value={settings?.environment ?? "localhost"}
                onChange={(e) =>
                  setSettings((s) => s && { ...s, environment: e.target.value as "localhost" | "production" })
                }
                disabled={!canEdit}
              >
                <option value="localhost">Localhost (développement)</option>
                <option value="production">Production</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">URL localhost</label>
              <input
                className="input-field"
                value={settings?.urlLocalhost ?? ""}
                onChange={(e) => setSettings((s) => s && { ...s, urlLocalhost: e.target.value })}
                disabled={!canEdit}
                placeholder="http://localhost:3000"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">URL production</label>
              <input
                className="input-field"
                value={settings?.urlProduction ?? ""}
                onChange={(e) => setSettings((s) => s && { ...s, urlProduction: e.target.value })}
                disabled={!canEdit}
                placeholder="https://stop3mr.ci"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Chemin de vérification</label>
              <input
                className="input-field"
                value={settings?.verifyPath ?? "/verify"}
                onChange={(e) => setSettings((s) => s && { ...s, verifyPath: e.target.value })}
                disabled={!canEdit}
                placeholder="/verify"
              />
              <p className="mt-1 text-xs text-slate-400">
                URL finale : {"{base}"}
                {settings?.verifyPath}/{"{numeroSerie}"}
              </p>
            </div>

            {canEdit && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={regenerateAll}
                  onChange={(e) => setRegenerateAll(e.target.checked)}
                />
                Régénérer tous les QR codes existants après sauvegarde
              </label>
            )}

            {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            {canEdit ? (
              <button type="submit" className="btn-primary w-full" disabled={saving}>
                {saving ? "Sauvegarde..." : "Enregistrer les paramètres"}
              </button>
            ) : (
              <p className="text-sm text-amber-600">Seul l&apos;administrateur peut modifier ces paramètres.</p>
            )}
          </form>

          <div className="card">
            <h2 className="mb-4 font-semibold">Aperçu QR (logo 3MR centré)</h2>
            {previewQr && (
              <div className="mx-auto mb-4 w-fit rounded-lg border border-slate-200 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewQr} alt="Aperçu QR" width={220} height={220} />
              </div>
            )}
            <p className="break-all text-xs text-slate-500">{previewUrl}</p>
            <p className="mt-4 text-xs text-slate-400">
              Environnement actif : <strong>{settings?.environment}</strong>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
