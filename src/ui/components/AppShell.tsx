"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigationItems = [
  { href: "/", label: "Registros", description: "Alta e historial" },
  { href: "/categories", label: "Categorías", description: "Catálogo" },
];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">GP</span>
          <span>
            <strong>Gestión Patrimonio</strong>
            <small>MVP</small>
          </span>
        </Link>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          {navigationItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? "nav-item active" : "nav-item"}
                href={item.href}
                key={item.href}
              >
                <span>{item.label}</span>
                <small>{item.description}</small>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div>
            <span className="topbar-kicker">Control financiero personal</span>
            <strong>Patrimonio mensual</strong>
          </div>
        </header>
        <main className="page-container">{children}</main>
      </div>
    </div>
  );
}
