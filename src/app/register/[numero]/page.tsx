"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ClientForm, ClientFormData } from "@/components/ClientForm";
import { swalError, swalSuccess } from "@/lib/swal";

type PlaqueInfo = {
  numeroSerie: string;
  typeProduit: string;
  dateFabrication: string;
  statut: string;
  siteProduction: string;
};

function RegisterForm() {
  const params = useParams();
  const { status } = useSession();
  const numero = decodeURIComponent(params.numero as string);
  const [token, setToken] = useState("");

  const [plaque, setPlaque] = useState<PlaqueInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    const storageKey = `register-token:${numero}`;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("token")) {
        url.searchParams.delete("token");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    }

    let cancelled = false;
    (async () => {
      try {
        let resolved = "";
        if (status === "authenticated") {
          const r = await fetch(`/api/plaques/${encodeURIComponent(numero)}/register-token`);
          if (r.ok) {
            const d = await r.json();
            resolved = d.token ?? "";
            if (resolved) sessionStorage.setItem(storageKey, resolved);
          }
        }
        if (!resolved) resolved = sessionStorage.getItem(storageKey) ?? "";
        if (cancelled) return;
        setToken(resolved);
        if (!resolved) {
          setError("Connectez-vous pour enregistrer cette plaque (le jeton n'est plus dans l'URL).");
          return;
        }
        const res = await fetch(`/api/register/${encodeURIComponent(numero)}`, {
          headers: { "X-Register-Token": resolved },
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Plaque introuvable");
        }
        const data = await res.json();
        if (cancelled) return;
        setPlaque(data.plaque);
        if (data.plaque.statut === "VENDUE") {
          setError("Cette plaque est déjà enregistrée comme vendue.");
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Plaque introuvable ou QR code invalide.";
        if (!cancelled) {
          setError(message);
          await swalError("Enregistrement impossible", message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [numero, status]);

  async function handleSubmit(data: ClientFormData) {
    setSubmitting(true);
    setError("");

    const v = data.vehicules[0];
    const { vehicules: _, ...clientFields } = data;

    const res = await fetch(`/api/register/${encodeURIComponent(numero)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Register-Token": token },
      body: JSON.stringify({
        ...clientFields,
        immatriculation: v.immatriculation,
        marqueVehicule: v.marqueVehicule,
        modeleVehicule: v.modeleVehicule,
        token,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error ?? "Erreur lors de l'enregistrement");
    }

    await swalSuccess("Plaque enregistrée", "Les informations du client ont été enregistrées.");
    setSuccess(true);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Chargement...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="card max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Enregistrement confirmé</h1>
          <p className="mt-2 text-sm text-slate-500">
            La plaque <strong className="font-mono">{numero}</strong> a été associée à votre véhicule.
            Une notification a été envoyée à l&apos;administrateur.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-red-600 text-sm font-bold text-white">
            3MR
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Enregistrement client</h1>
          <p className="text-sm text-slate-500">Associez cette plaque à votre véhicule</p>
        </div>

        {plaque && (
          <div className="card mb-4 bg-slate-50">
            <p className="text-xs text-slate-500">Plaque concernée</p>
            <p className="font-mono font-bold">{plaque.numeroSerie}</p>
            <p className="text-sm text-slate-600">
              {plaque.typeProduit.replace("_", " ")} — Site {plaque.siteProduction} —{" "}
              {new Date(plaque.dateFabrication).toLocaleDateString("fr-FR")}
            </p>
            <p className="mt-1 text-xs text-slate-400">Prix de référence : 3 000 F CFA</p>
          </div>
        )}

        <div className="card">
          {error && !plaque ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : (
            <>
              {error && (
                <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>
              )}
              <ClientForm
                onSubmit={handleSubmit}
                loading={submitting}
                submitLabel="Valider l'enregistrement"
                showFne={false}
                singleVehicle
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RegisterClientPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Chargement...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
