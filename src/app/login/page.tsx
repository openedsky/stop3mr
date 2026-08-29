"use client";

import { FormEvent, Suspense, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandProtection } from "@/components/BrandProtection";
import { Req } from "@/components/Req";
import { homePathForRole } from "@/lib/roles";
import { safeCallbackUrl } from "@/lib/security";
import { swalError, swalToast } from "@/lib/swal";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await signIn("credentials", {
      identifiant,
      motDePasse,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      await swalError("Échec de connexion", "Identifiant ou mot de passe incorrect.");
      return;
    }

    await swalToast("success", "Connexion réussie");
    const session = await getSession();
    const fallback = homePathForRole(session?.user.role ?? "");
    const requested = safeCallbackUrl(searchParams.get("callbackUrl"), fallback);
    const next =
      requested === fallback ||
      session?.user.role === "ADMINISTRATEUR" ||
      (session?.user.role === "OPERATEUR" &&
        (requested === "/carte" || requested.startsWith("/carte/"))) ||
      !(requested === "/carte" || requested.startsWith("/carte/") || requested.startsWith("/admin"))
        ? requested
        : fallback;
    router.push(next);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 px-4">
      <BrandProtection>
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600 text-xl font-bold text-white">
              3MR
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Stop Réfléchissant 3M</h1>
            <p className="mt-2 text-sm text-slate-500">
              Accès sécurisé — Back-office de gestion
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="identifiant" className="mb-1 block text-sm font-medium text-slate-700">
                Identifiant<Req />
              </label>
              <input
                id="identifiant"
                type="text"
                className="input-field"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="motDePasse" className="mb-1 block text-sm font-medium text-slate-700">
                Mot de passe<Req />
              </label>
              <input
                id="motDePasse"
                type="password"
                className="input-field"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Vérification publique QR : scannez directement le code sur la plaque
          </p>
        </div>
      </BrandProtection>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Chargement...</div>}>
      <LoginForm />
    </Suspense>
  );
}
