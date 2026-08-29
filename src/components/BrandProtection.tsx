"use client";

import { useEffect } from "react";

export function BrandProtection({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const preventContext = (e: MouseEvent) => e.preventDefault();
    const preventKeys = (e: KeyboardEvent) => {
      if (
        e.key === "PrintScreen" ||
        (e.ctrlKey && ["p", "s", "u"].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", preventContext);
    document.addEventListener("keydown", preventKeys);
    return () => {
      document.removeEventListener("contextmenu", preventContext);
      document.removeEventListener("keydown", preventKeys);
    };
  }, []);

  return <div className="protected-content">{children}</div>;
}

export function Watermark({ text }: { text: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.06]"
      aria-hidden
    >
      <span className="rotate-[-25deg] text-4xl font-bold tracking-widest text-slate-900">
        {text}
      </span>
    </div>
  );
}
