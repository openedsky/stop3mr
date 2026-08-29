"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Req } from "@/components/Req";
import { swalConfirm, swalError, swalSuccess } from "@/lib/swal";

export default function ChangePasswordPage() {
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (nouveau !== confirmation) {
      await swalError("Confirmation incorrecte", "Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    const ok = await swalConfirm("Modifier le mot de passe ?", "Vous utiliserez ce mot de passe à la prochaine connexion.", "Enregistrer");
    if (!ok) return;
    setLoading(true);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actuel, nouveau, confirmation }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      await swalError("Modification impossible", data.error ?? "Erreur");
      return;
    }
    setActuel("");
    setNouveau("");
    setConfirmation("");
    await swalSuccess("Mot de passe modifié", "Utilisez le nouveau mot de passe lors de votre prochaine connexion.");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <Link href="/profile" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Mon profil
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Modifier le mot de passe</h1>
        <p className="mb-6 text-slate-500">
          Saisissez votre mot de passe actuel, puis choisissez un nouveau mot de passe.
        </p>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Mot de passe actuel<Req /></label>
            <input
              className="input-field"
              type="password"
              autoComplete="current-password"
              value={actuel}
              onChange={(e) => setActuel(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nouveau mot de passe<Req /></label>
            <input
              className="input-field"
              type="password"
              autoComplete="new-password"
              value={nouveau}
              onChange={(e) => setNouveau(e.target.value)}
              required
              minLength={12}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Confirmer le nouveau mot de passe<Req /></label>
            <input
              className="input-field"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
              minLength={12}
            />
          </div>
          <p className="text-xs text-slate-400">
            Au moins 12 caractères, avec une majuscule, une minuscule et un chiffre.
          </p>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Enregistrement..." : "Enregistrer"}
          </button>
        </form>
      </main>
    </div>
  );
}
