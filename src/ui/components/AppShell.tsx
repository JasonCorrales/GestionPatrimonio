"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getCurrentSession, onAuthStateChange, signOut } from "@/data/supabase/auth";

const navigationItems = [
  { href: "/", label: "Dashboard", description: "Resumen mensual" },
  { href: "/records", label: "Registros", description: "Alta e historial" },
  { href: "/categories", label: "Categorías", description: "Catálogo" },
  { href: "/retirement", label: "Jubilación", description: "Interés compuesto" },
];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    getCurrentSession()
      .then((currentSession) => {
        if (!mounted) {
          return;
        }

        setSession(currentSession);
        setAuthError(null);
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }

        setAuthError(getErrorMessage(error));
      })
      .finally(() => {
        if (mounted) {
          setLoadingSession(false);
        }
      });

    const subscription = onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoadingSession(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loadingSession) {
      return;
    }

    if (!session && !isLoginPage) {
      router.replace("/login");
      return;
    }

    if (session && isLoginPage) {
      router.replace("/");
    }
  }, [isLoginPage, loadingSession, router, session]);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loadingSession) {
    return <FullPageStatus title="Validando sesión" message="Un momento..." />;
  }

  if (authError) {
    return <FullPageStatus title="Error de autenticación" message={authError} />;
  }

  if (!session) {
    return <FullPageStatus title="Redirigiendo" message="Te llevamos al login..." />;
  }

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
          <div className="session-chip">
            <span>{session.user.email}</span>
            <button type="button" onClick={handleSignOut}>Salir</button>
          </div>
        </header>
        <main className="page-container">{children}</main>
      </div>
    </div>
  );
}

function FullPageStatus({ title, message }: Readonly<{ title: string; message: string }>) {
  return (
    <main className="auth-page">
      <section className="auth-card compact-status">
        <p className="eyebrow">Sesión</p>
        <h1>{title}</h1>
        <p className="message">{message}</p>
      </section>
    </main>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
