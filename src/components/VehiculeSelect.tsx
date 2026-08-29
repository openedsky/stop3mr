"use client";

import { useEffect, useState } from "react";
import { formatVehiculeLabel } from "@/lib/vehicules";

type VehiculeOption = {
  id: number;
  immatriculation: string;
  marqueVehicule: string | null;
  modeleVehicule: string | null;
};

export function VehiculeSelect({
  clientId,
  value,
  onChange,
  required = true,
}: {
  clientId: string;
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
}) {
  const [vehicules, setVehicules] = useState<VehiculeOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setVehicules([]);
      return;
    }
    setLoading(true);
    fetch(`/api/clients/${clientId}/vehicules`)
      .then((r) => r.json())
      .then((d) => setVehicules(d.vehicules ?? []))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (!clientId) {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
        Sélectionnez d&apos;abord un client
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Chargement des véhicules...</p>;
  }

  if (vehicules.length === 0) {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
        Aucun véhicule enregistré pour ce client
        {required ? ". Ajoutez-en un depuis sa fiche client." : " — la vente peut continuer sans véhicule."}
      </p>
    );
  }

  return (
    <select
      className="input-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      <option value="">— Sélectionner le véhicule —</option>
      {vehicules.map((v) => (
        <option key={v.id} value={v.id}>
          {formatVehiculeLabel(v)}
        </option>
      ))}
    </select>
  );
}
