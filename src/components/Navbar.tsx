"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { AppRole, ROLE_LABELS } from "@/lib/roles";
import { swalConfirm } from "@/lib/swal";
import {
  ACCOUNT_LINKS,
  MenuItem,
  isGroupActive,
  isNavActive,
  menuForRole,
} from "@/lib/menu";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const role = session?.user.role as AppRole | undefined;
  const items = role ? menuForRole(role) : [];

  async function handleLogout() {
    setOpenMenu(null);
    setMobileOpen(false);
    const ok = await swalConfirm(
      "Se déconnecter ?",
      "Voulez-vous vraiment quitter la session en cours ?",
      "Se déconnecter"
    );
    if (ok) await signOut({ callbackUrl: "/login" });
  }

  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <>
      <header ref={navRef} className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex shrink-0 items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-xs font-bold text-white">
                3MR
              </div>
              <div className="hidden min-[420px]:block">
                <p className="text-sm font-bold leading-tight text-slate-900">Stop Réfléchissant 3M</p>
                <p className="text-[11px] text-slate-500">Plateforme de traçabilité</p>
              </div>
            </Link>

            {session?.user && role && (
              <>
                <nav
                  className="ml-2 hidden min-w-0 flex-1 flex-nowrap items-center justify-center gap-0.5 lg:flex"
                  aria-label="Navigation principale"
                >
                  {items.map((item) => (
                      <NavEntry
                      key={item.label}
                      item={item}
                      pathname={pathname}
                      open={openMenu === item.label}
                      onOpen={() => setOpenMenu(item.label)}
                      onClose={() => setOpenMenu(null)}
                    />
                  ))}
                </nav>

                <div className="ml-auto flex items-center gap-2">
                  <div
                    className="relative hidden md:block"
                    onMouseEnter={() => setOpenMenu("compte")}
                    onMouseLeave={() => setOpenMenu((current) => (current === "compte" ? null : current))}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenMenu("compte")}
                      className={`rounded-lg px-3 py-1.5 text-right transition ${
                        ACCOUNT_LINKS.some((l) => isNavActive(pathname, l.href))
                          ? "bg-red-50"
                          : "hover:bg-slate-50"
                      }`}
                      aria-expanded={openMenu === "compte"}
                      aria-haspopup="menu"
                    >
                      <p className="text-sm font-medium leading-tight text-slate-800">
                        {session.user.name || session.user.identifiant}
                      </p>
                      <p className="text-[11px] text-slate-500">{ROLE_LABELS[role]}</p>
                    </button>
                    {openMenu === "compte" && (
                      <div className="absolute right-0 top-full z-50 min-w-[200px] pt-1">
                        <div role="menu" className="rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                        {ACCOUNT_LINKS.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            role="menuitem"
                            className={`block px-4 py-2.5 text-sm hover:bg-red-50 hover:text-red-700 ${
                              isNavActive(pathname, link.href)
                                ? "bg-red-50 font-medium text-red-700"
                                : "text-slate-700"
                            }`}
                          >
                            {link.label}
                          </Link>
                        ))}
                        <div className="my-1 border-t border-slate-100" />
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            void handleLogout();
                          }}
                          className="block w-full px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50"
                        >
                          Déconnexion
                        </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 lg:!hidden"
                    onClick={() => setMobileOpen((open) => !open)}
                    aria-expanded={mobileOpen}
                    aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
                  >
                    {mobileOpen ? "Fermer" : "Menu"}
                  </button>
                </div>
              </>
            )}
          </div>

          {mobileOpen && session?.user && role && (
            <nav className="mt-3 space-y-3 border-t border-slate-100 pt-3 lg:hidden" aria-label="Menu mobile">
              {items.map((item) => (
                <div key={item.label}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                        isNavActive(pathname, item.href) ? "bg-red-50 text-red-700" : "text-slate-700"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <>
                      <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {item.label}
                      </p>
                      {item.children?.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`block rounded-lg px-5 py-2 text-sm ${
                            isNavActive(pathname, child.href)
                              ? "bg-red-50 font-medium text-red-700"
                              : "text-slate-700"
                          }`}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              ))}
              <div>
                <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Compte
                </p>
                {ACCOUNT_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`block rounded-lg px-5 py-2 text-sm ${
                      isNavActive(pathname, link.href) ? "bg-red-50 font-medium text-red-700" : "text-slate-700"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleLogout();
                }}
                className="btn-secondary w-full !text-xs"
              >
                Déconnexion
              </button>
            </nav>
          )}
        </div>
      </header>
    </>
  );
}

function NavEntry({
  item,
  pathname,
  open,
  onOpen,
  onClose,
}: {
  item: MenuItem;
  pathname: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const active = isGroupActive(pathname, item);
  const className = `rounded-lg px-2.5 py-2 text-sm font-medium transition ${
    active ? "bg-red-50 text-red-700" : "text-slate-600 hover:bg-slate-50 hover:text-red-600"
  }`;

  if (!item.children) {
    return (
      <Link href={item.href!} className={className}>
        {item.label}
      </Link>
    );
  }

  return (
    <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <button
        type="button"
        onClick={onOpen}
        className={`flex items-center gap-1 ${className}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {item.label}
        <svg className="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className={`absolute top-full z-50 min-w-[220px] pt-1 ${item.align === "right" ? "right-0" : "left-0"}`}>
          <div role="menu" className="rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {item.children.map((child) => (
              <div key={child.href}>
                {child.dividerBefore && <div className="my-1 border-t border-slate-100" />}
                <Link
                  href={child.href}
                  role="menuitem"
                  className={`block px-4 py-2.5 text-sm hover:bg-red-50 hover:text-red-700 ${
                    isNavActive(pathname, child.href) ? "bg-red-50 font-medium text-red-700" : "text-slate-700"
                  }`}
                >
                  {child.label}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
