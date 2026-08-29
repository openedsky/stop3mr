"use client";

import { useEffect, useRef, useState } from "react";

export type CentreOption = {
  id: number;
  code?: string;
  libelle: string;
  ville: string | null;
  commune?: string | null;
  quartier?: string | null;
};

export function centreLabel(c: CentreOption) {
  const lieu = [c.ville, c.commune, c.quartier].filter(Boolean).join(" · ");
  return lieu ? `${c.libelle} (${lieu})` : c.libelle;
}

export function CentreSelect({
  value,
  onChange,
  initialCentre,
  required = false,
  placeholder = "Rechercher un centre (ville, commune, nom)…",
}: {
  value: string;
  onChange: (id: string, centre?: CentreOption) => void;
  initialCentre?: CentreOption | null;
  required?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<CentreOption[]>(initialCentre ? [initialCentre] : []);
  const [selected, setSelected] = useState<CentreOption | null>(initialCentre ?? null);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialCentre && !selected) {
      setSelected(initialCentre);
      setOptions((prev) => (prev.some((c) => c.id === initialCentre.id) ? prev : [initialCentre, ...prev]));
    }
  }, [initialCentre, selected]);

  useEffect(() => {
    if (value && selected && String(selected.id) !== value) {
      const found = options.find((c) => String(c.id) === value);
      if (found) setSelected(found);
    }
    if (!value) setSelected(null);
  }, [value, options, selected]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ limit: "40" });
      if (query.trim()) params.set("q", query.trim());
      fetch(`/api/centres?${params}`)
        .then((r) => r.json())
        .then((d) => {
          const list: CentreOption[] = d.centres ?? [];
          if (selected && !list.some((c) => c.id === selected.id)) {
            list.unshift(selected);
          }
          setOptions(list);
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [open, query, selected]);

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
        placeholder={placeholder}
        value={open ? query : selected ? centreLabel(selected) : query}
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
        aria-controls="centre-results"
      />
      {required && <input type="hidden" value={value} required readOnly tabIndex={-1} />}
      {open && (
        <ul
          id="centre-results"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {loading && <li className="px-3 py-2 text-sm text-slate-400">Recherche...</li>}
          {options.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  String(c.id) === value ? "bg-red-50 font-medium text-red-700" : "text-slate-800"
                }`}
                onClick={() => {
                  setSelected(c);
                  onChange(String(c.id), c);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="font-medium">{c.libelle}</span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  {[c.code, c.ville, c.commune, c.quartier].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
          {!loading && options.length === 0 && (
            <li className="px-3 py-3 text-sm text-slate-400">Aucun centre ne correspond.</li>
          )}
        </ul>
      )}
    </div>
  );
}
