"use client";

import { ReactNode } from "react";

type PaginationBarProps = {
  page: number;
  pages: number;
  total?: number;
  onPage: (page: number) => void;
  label?: string;
};

export function PaginationBar({ page, pages, total, onPage, label = "élément" }: PaginationBarProps) {
  if (pages <= 1 && total == null) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      {total != null && (
        <p className="text-xs text-slate-400">
          {total} {label}{total > 1 ? "s" : ""} — page {page} / {Math.max(pages, 1)}
        </p>
      )}
      {pages > 1 && (
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary !py-1.5 !text-xs"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            Précédent
          </button>
          <button
            type="button"
            className="btn-secondary !py-1.5 !text-xs"
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

type TableSearchProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  filters?: ReactNode;
};

export function TableSearch({
  value,
  onChange,
  onSubmit,
  placeholder = "Rechercher…",
  filters,
}: TableSearchProps) {
  return (
    <form
      className="mb-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {filters ? <div className="flex flex-wrap items-end gap-3">{filters}</div> : null}
      <div className="flex gap-2">
        <input
          className="input-field"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="submit" className="btn-secondary shrink-0">
          Rechercher
        </button>
      </div>
    </form>
  );
}

export function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-[140px] flex-1 sm:flex-none sm:w-44">
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}
