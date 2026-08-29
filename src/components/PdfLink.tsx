"use client";

import { useState } from "react";
import { swalError } from "@/lib/swal";

type PdfLinkProps = {
  href: string;
  children?: React.ReactNode;
  className?: string;
};

export function PdfLink({
  href,
  children = "PDF",
  className = "text-xs text-slate-600 hover:underline disabled:opacity-50",
}: PdfLinkProps) {
  const [loading, setLoading] = useState(false);

  async function openPdf(event: React.MouseEvent) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      const response = await fetch(href, { credentials: "include" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        await swalError("PDF indisponible", payload?.error ?? "Impossible d'afficher le PDF");
        return;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/pdf")) {
        await swalError("PDF indisponible", "Le document PDF n'a pas pu être généré");
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      await swalError("PDF indisponible", "Erreur réseau lors de l'ouverture du PDF");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={openPdf} disabled={loading} className={className}>
      {loading ? "..." : children}
    </button>
  );
}
