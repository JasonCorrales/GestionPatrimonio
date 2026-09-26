"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getCurrentSession, onAuthStateChange, signOut } from "@/data/supabase/auth";
import { CurrencyPreferenceProvider, useCurrencyPreference, type DisplayCurrency } from "@/ui/currency";

const navigationItems = [
  { href: "/", label: "Dashboard", description: "Resumen mensual" },
  { href: "/records", label: "Registros", description: "Alta e historial" },
  { href: "/categories", label: "Categorías", description: "Catálogo" },
  { href: "/retirement", label: "Jubilación", description: "Interés compuesto" },
];

type ThemePreference = "light" | "dark";

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";
  const [theme, setTheme] = useState<ThemePreference>(() => getInitialTheme());
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme-preference", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

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
    <CurrencyPreferenceProvider>
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
          <div className="topbar-actions">
            <CurrencyPreferenceControls />
            <button
              aria-label={theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
              className="theme-toggle"
              onClick={toggleTheme}
              title={theme === "light" ? "Modo oscuro" : "Modo claro"}
              type="button"
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            <div className="session-chip">
              <span>{session.user.email}</span>
              <button type="button" onClick={handleSignOut}>Salir</button>
            </div>
          </div>
        </header>
        <main className="page-container">{children}</main>
        </div>
      </div>
    </CurrencyPreferenceProvider>
  );
}

function CurrencyPreferenceControls() {
  const {
    displayCurrency,
    exchangeRate,
    exchangeRateMetadata,
    exchangeRateStatus,
    refreshExchangeRate,
    setDisplayCurrency,
    setExchangeRate,
  } = useCurrencyPreference();
  function handleCurrencyChange(value: string) {
    setDisplayCurrency(value === "USD" ? "USD" : "CRC");
  }

  return (
    <div className="currency-controls" aria-label="Preferencia de moneda">
      <label>
        <span>Moneda</span>
        <select
          value={displayCurrency}
          onChange={(event) => handleCurrencyChange(event.target.value as DisplayCurrency)}
        >
          <option value="CRC">CRC</option>
          <option value="USD">USD</option>
        </select>
      </label>
      {displayCurrency === "USD" ? (
        <>
          <ExchangeRateInput
            exchangeRate={exchangeRate}
            key={exchangeRate}
            onRateChange={setExchangeRate}
          />
          <button
            className="exchange-rate-refresh"
            disabled={exchangeRateStatus === "loading"}
            onClick={() => void refreshExchangeRate()}
            title={exchangeRateMetadata.message ?? "Actualizar tipo de cambio BCCR"}
            type="button"
          >
            {exchangeRateStatus === "loading" ? "Actualizando..." : getExchangeRateLabel(exchangeRateMetadata.source, exchangeRateMetadata.date)}
          </button>
        </>
      ) : null}
    </div>
  );
}

function ExchangeRateInput({
  exchangeRate,
  onRateChange,
}: Readonly<{
  exchangeRate: number;
  onRateChange: (rate: number) => void;
}>) {
  const [rateInput, setRateInput] = useState(() => String(exchangeRate));

  function handleRateChange(value: string) {
    setRateInput(value);

    const parsedRate = Number(value);
    if (Number.isFinite(parsedRate) && parsedRate > 0) {
      onRateChange(parsedRate);
    }
  }

  function handleRateBlur() {
    const parsedRate = Number(rateInput);

    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      setRateInput(String(exchangeRate));
    }
  }

  return (
    <label>
      <span>CRC/USD</span>
      <input
        min="1"
        step="0.01"
        type="number"
        value={rateInput}
        onBlur={handleRateBlur}
        onChange={(event) => handleRateChange(event.target.value)}
      />
    </label>
  );
}

function getExchangeRateLabel(source: "BCCR" | "manual" | "fallback", date?: string) {
  if (source === "BCCR") {
    return date ? `BCCR ${date}` : "BCCR";
  }

  if (source === "manual") {
    return "Manual";
  }

  return "Fallback";
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

function getInitialTheme(): ThemePreference {
  if (typeof window === "undefined") {
    return "light";
  }

  const savedTheme = localStorage.getItem("theme-preference");

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
