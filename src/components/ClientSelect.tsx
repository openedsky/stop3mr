"use client";

import { useEffect, useState } from "react";

type ClientOption = {
  id: number;
  nom: string;
  vehiculesSummary?: string;
  vehicules?: Array<{ immatriculation: string }>;
};

export function ClientSelect({
  value,
  onChange,
  required = true,
}: {
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
}) {
  const [clients, setClients] = useState<ClientOption[]>([]);

  useEffect(() => {
    fetch("/api/clients?limit=100")
      .then((r) => r.json())
      .then((d) => setClients(d.clients));
  }, []);

  return (
    <select className="input-field" value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">— Sélectionner un client —</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nom} — {c.vehiculesSummary ?? "—"}
        </option>
      ))}
    </select>
  );
}
