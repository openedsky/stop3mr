"use client";

import { useEffect, useRef } from "react";
import type { CentreCarte } from "@/lib/geo";
import { CI_CENTER, CI_DEFAULT_ZOOM, siteKey } from "@/lib/geo";
import "leaflet/dist/leaflet.css";

type Props = {
  centres: CentreCarte[];
  selectedKey?: string | null;
  onSelect?: (site: CentreCarte) => void;
  pickMode?: boolean;
  onPick?: (lat: number, lng: number) => void;
  className?: string;
};

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function markerColor(c: CentreCarte): string {
  if (c.kind === "production") return "#7c3aed";
  if (c.stats.stockDisponible > 0) return "#16a34a";
  if (c.stats.ventes > 0) return "#2563eb";
  if (c.stats.verifications > 0) return "#d97706";
  return c.couvertVendeur ? "#64748b" : "#94a3b8";
}

export function CentresMap({ centres, selectedKey, onSelect, pickMode, onPick, className }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const onPickRef = useRef(onPick);
  onSelectRef.current = onSelect;
  onPickRef.current = onPick;

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current) return;

      map = L.map(elRef.current, {
        scrollWheelZoom: true,
        zoomControl: true,
        preferCanvas: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const positioned = centres.filter((c) => c.georeference);
      if (positioned.length > 0) {
        const bounds = L.latLngBounds(positioned.map((c) => [c.latitude!, c.longitude!] as [number, number]));
        map.fitBounds(bounds.pad(0.12), { maxZoom: 8 });
      } else {
        map.setView(CI_CENTER, CI_DEFAULT_ZOOM);
      }

      const canvas = L.canvas({ padding: 0.5 });
      for (const c of positioned) {
        const key = siteKey(c.kind, c.id);
        const isSelected = selectedKey === key;
        const color = markerColor(c);
        const isUsine = c.kind === "production";
        const radius = isUsine ? 11 : 5 + Math.min(8, Math.sqrt(c.stats.stockDisponible + c.stats.ventes) * 1.4);

        const html = `
          <div class="min-w-[220px] text-sm">
            <p class="text-[10px] font-semibold uppercase tracking-wide ${isUsine ? "text-violet-700" : "text-sky-700"}">${
              isUsine ? "Site de production" : "Centre de contrôle technique"
            }</p>
            <p class="font-semibold text-slate-900">${esc(c.libelle)}</p>
            <p class="text-xs text-slate-500 mb-2">${esc(c.adresseComplete || c.code)}</p>
            <p class="text-[11px] font-mono text-slate-400 mb-2">${c.latitude!.toFixed(5)}, ${c.longitude!.toFixed(5)}</p>
            ${
              isUsine
                ? `<p class="text-xs">Stock usine : <strong>${c.stats.stockDisponible}</strong></p>`
                : `<div class="grid grid-cols-3 gap-1 text-center text-xs mb-2">
                    <div><strong>${c.stats.stockDisponible}</strong><br/>dispo</div>
                    <div><strong>${c.stats.ventes}</strong><br/>ventes</div>
                    <div><strong>${c.stats.verifications}</strong><br/>contrôles</div>
                  </div>
                  <p class="text-[11px] text-slate-500">${c.stats.commerciaux} vendeur(s) · ${c.stats.agents} agent(s)${
                    c.couvertVendeur ? "" : " · <span class='text-amber-700'>sans vendeur</span>"
                  }</p>`
            }
          </div>
        `;

        const marker = L.circleMarker([c.latitude!, c.longitude!], {
          renderer: canvas,
          radius: isSelected ? radius + 3 : radius,
          color: isSelected ? "#991b1b" : isUsine ? "#5b21b6" : color,
          weight: isUsine ? 3 : c.couvertVendeur ? 1.5 : 1,
          fillColor: color,
          fillOpacity: isUsine ? 0.9 : c.couvertVendeur ? 0.75 : 0.4,
        })
          .addTo(map)
          .bindPopup(html, { maxWidth: 280 });

        marker.on("click", () => onSelectRef.current?.(c));
      }

      if (pickMode) {
        map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
          onPickRef.current?.(e.latlng.lat, e.latlng.lng);
        });
      }

      setTimeout(() => map?.invalidateSize(), 80);
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [centres, selectedKey, pickMode]);

  return (
    <div className={className}>
      <div ref={elRef} className="h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-slate-200" />
    </div>
  );
}

export function CarteLegende() {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-slate-600">
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-700" /> Usine de production
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600" /> CT — stock vendeur
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600" /> CT — ventes
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-600" /> CT — contrôles
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400 opacity-60" /> CT sans vendeur
      </li>
    </ul>
  );
}
