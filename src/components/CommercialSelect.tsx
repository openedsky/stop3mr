"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type CommercialOption = {
  id: number;
  identifiant: string;
  prenom: string | null;
  nom: string | null;
  codeCommercial: number | null;
  stockAffecte: number;
};

function labelOf(c: CommercialOption) {
  const nom = [c.prenom, c.nom].filter(Boolean).join(" ") || c.identifiant;
  return `${c.codeCommercial ?? "—"} — ${nom} — stock vendeur : ${c.stockAffecte}`;
}

export function CommercialSelect({
  commerciaux,
  value,
  onChange,
}: {
  commerciaux: CommercialOption[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = commerciaux.find((c) => String(c.id) === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commerciaux;
    return commerciaux.filter((c) => {
      const hay = [
        c.codeCommercial?.toString() ?? "",
        c.prenom ?? "",
        c.nom ?? "",
        c.identifiant,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [commerciaux, query]);

  const shown = useMemo(() => {
    if (query.trim()) return filtered.slice(0, 50);
    return filtered.slice(0, 25);
  }, [filtered, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <input
        className="input-field"
        placeholder="Rechercher un commercial (code, nom, prénom)…"
        value={open ? query : selected ? labelOf(selected) : query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        autoComplete="off"
        aria-expanded={open}
        aria-controls="commercial-results"
      />
      {open && (
        <ul
          id="commercial-results"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {shown.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  String(c.id) === value ? "bg-red-50 font-medium text-red-700" : "text-slate-800"
                }`}
                onClick={() => {
                  onChange(String(c.id));
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="font-mono text-xs text-slate-500">{c.codeCommercial ?? "—"}</span>
                {" — "}
                {[c.prenom, c.nom].filter(Boolean).join(" ") || c.identifiant}
                <span className="mt-0.5 block text-xs text-slate-400">
                  {c.identifiant} · stock vendeur : {c.stockAffecte}
                </span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-3 text-sm text-slate-400">Aucun commercial ne correspond.</li>
          )}
          {filtered.length > shown.length && (
            <li className="px-3 py-2 text-xs text-slate-400">
              {filtered.length - shown.length} autre(s) — affinez la recherche (code, nom ou prénom).
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
