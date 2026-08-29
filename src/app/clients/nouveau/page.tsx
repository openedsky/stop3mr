"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { ClientForm, ClientFormData } from "@/components/ClientForm";
import { swalSuccess } from "@/lib/swal";

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(data: ClientFormData) {
    setLoading(true);
    setError("");
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error ?? "Erreur");
    }
    const { client } = await res.json();
    await swalSuccess("Client enregistré");
    router.push(`/clients/${client.id}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <Link href="/clients" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Retour aux clients
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Nouveau client</h1>
        <p className="mb-6 text-slate-500">
          Personne physique, organisation ou personne morale. Utilisable pour une vente commerciale ou une vente
          directe sans commission.
        </p>
        <div className="card">
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <ClientForm onSubmit={handleSubmit} loading={loading} submitLabel="Créer le client" />
        </div>
      </main>
    </div>
  );
}
