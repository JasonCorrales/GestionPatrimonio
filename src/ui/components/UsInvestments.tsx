"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentSession } from "@/data/supabase/auth";
import { planIbkrPoll } from "@/ui/ibkrPolling";

type Money = { amount: string; currency: string } | null;
type Position = {
  symbol: string | null;
  currency: string;
  quantity: string | null;
  markPrice: string | null;
  positionValue: string | null;
  costBasisMoney: string | null;
  costBasisPrice: string | null;
  fifoPnlUnrealized: string | null;
};
type PortfolioStatus = {
  configured: boolean;
  owner: boolean;
  snapshot: null | {
    accountId: string;
    reportDate: string;
    generatedAt: string | null;
    syncedAt: string;
    nav: Money;
    cash: Money;
    positions: Position[];
  };
  sync: null | {
    jobId: string;
    state: string;
    attempts: number;
    nextAttemptAt: string | null;
    cooldownUntil: string | null;
    updatedAt: string;
    message: string | null;
  };
  error?: string;
  errorStage?: string;
  errorCode?: string;
  secondaryErrorStage?: string;
  secondaryErrorCode?: string;
};

export function UsInvestments() {
  const [status, setStatus] = useState<PortfolioStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pollFailures, setPollFailures] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const next = await apiRequest("/api/ibkr/portfolio/status");
      setStatus(next);
      setPollFailures(0);
      setMessage(formatStatusMessage(next));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo leer IBKR.");
    } finally {
      setLoading(false);
    }
  }, []);

  const continueSync = useCallback(async (jobId: string) => {
    setSyncing(true);
    try {
      const next = await apiRequest("/api/ibkr/sync", { action: "continue", jobId });
      setStatus(next);
      setPollFailures(0);
      setMessage(formatStatusMessage(next) ?? next.sync?.message ?? null);
    } catch (error) {
      if (error instanceof IbkrApiError && error.status === 403) {
        setStatus({ configured: true, owner: false, snapshot: null, sync: null, error: error.message });
        setPollFailures(0);
        setMessage(error.message);
        return;
      }
      setPollFailures((count) => count + 1);
      setMessage(error instanceof Error ? error.message : "No se pudo continuar la sincronización.");
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadStatus);
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [loadStatus]);

  useEffect(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    const decision = planIbkrPoll({ sync: status?.sync, nowMs: Date.now(), failedAttempts: pollFailures });
    if (decision.action !== "poll") return;
    pollTimer.current = setTimeout(() => void continueSync(status?.sync?.jobId ?? ""), decision.delayMs);
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [continueSync, pollFailures, status?.sync]);

  async function startSync() {
    setSyncing(true);
    try {
      const next = await apiRequest("/api/ibkr/sync", { action: "start" });
      setStatus(next);
      setPollFailures(0);
      setMessage(formatStatusMessage(next) ?? next.sync?.message ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar la sincronización.");
    } finally {
      setSyncing(false);
    }
  }

  const snapshot = status?.snapshot ?? null;
  const activeSync = status?.sync && ["requested", "pending"].includes(status.sync.state);
  const canResumeSync = Boolean(activeSync && pollFailures >= 3);
  const valuesByCurrency = useMemo(() => groupPositionValues(snapshot?.positions ?? []), [snapshot]);

  return (
    <div className="content-stack investments-page">
      <section className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">Broker externo</p>
          <h1>Inversiones USA</h1>
          <p>Lectura manual de snapshots de Interactive Brokers Flex. No muestra datos en vivo ni impacta los totales de patrimonio.</p>
        </div>
        <button className="primary-action" disabled={syncing || (Boolean(activeSync) && !canResumeSync)} onClick={canResumeSync && status?.sync ? () => void continueSync(status.sync!.jobId) : startSync} type="button">
          {syncing ? "Sincronizando..." : canResumeSync ? "Reanudar sincronización" : activeSync ? "Sincronizando..." : "Sincronizar manualmente"}
        </button>
      </section>

      {loading && !status ? <section className="card"><p className="muted">Cargando estado...</p></section> : null}
      {message ? <section className="card status-banner"><strong>Estado</strong><p>{message}</p></section> : null}
      {status && !status.configured ? <section className="card"><h2>Integración no configurada</h2><p className="muted">Faltan variables de servidor para IBKR. No ingreses credenciales en el navegador.</p></section> : null}
      {status && !status.owner ? <section className="card"><h2>Acceso restringido</h2><p className="muted">Esta vista está disponible solo para el usuario propietario configurado.</p></section> : null}

      {snapshot ? (
        <>
          <section className="metrics-grid">
            <Metric label="NAV base" value={formatMoney(snapshot.nav)} />
            <Metric label="Efectivo" value={formatMoney(snapshot.cash)} />
            <Metric label="Fecha del reporte" value={snapshot.reportDate} />
          </section>
          <section className="card compact-stack">
            <div className="section-title-row">
              <div>
                <h2>Resumen del snapshot</h2>
                <p className="muted">Última sincronización: {formatDateTime(snapshot.syncedAt)}. Generado por IBKR: {snapshot.generatedAt ? formatDateTime(snapshot.generatedAt) : "—"}.</p>
              </div>
            </div>
            {valuesByCurrency.length ? <div className="currency-value-grid">{valuesByCurrency.map((item) => <Metric key={item.currency} label={`Valor posiciones ${item.currency}`} value={formatMoney(item)} />)}</div> : <p className="empty-state">No hay valores de posiciones para agrupar.</p>}
          </section>
          <section className="card">
            <div className="section-title-row"><h2>Posiciones</h2><span className="pill">{snapshot.positions.length} filas</span></div>
            {snapshot.positions.length ? <PositionsTable positions={snapshot.positions} /> : <p className="empty-state">El snapshot no contiene posiciones abiertas.</p>}
          </section>
        </>
      ) : status && !loading ? (
        <section className="card"><h2>Sin snapshot guardado</h2><p className="muted">Usa la sincronización manual para solicitar el primer reporte Flex.</p></section>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong></article>;
}

function PositionsTable({ positions }: Readonly<{ positions: Position[] }>) {
  return <div className="positions-table"><table><thead><tr><th>Símbolo</th><th>Cantidad</th><th>Precio</th><th>Valor</th><th>Costo</th><th>P/L</th><th>Moneda</th></tr></thead><tbody>{positions.map((position, index) => <tr key={`${position.symbol ?? "pos"}-${position.currency}-${index}`}><td><strong>{position.symbol ?? "—"}</strong></td><td>{formatNumber(position.quantity)}</td><td>{formatMoneyField(position.markPrice, position.currency)}</td><td>{formatMoneyField(position.positionValue, position.currency)}</td><td>{formatMoneyField(position.costBasisMoney, position.currency)}</td><td>{formatMoneyField(position.fifoPnlUnrealized, position.currency)}</td><td>{position.currency}</td></tr>)}</tbody></table></div>;
}

async function apiRequest(url: string, body?: object): Promise<PortfolioStatus> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error("Se requiere iniciar sesión.");
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const payload = await response.json() as PortfolioStatus;
  if (!response.ok) {
    throw new IbkrApiError(response.status, formatStatusMessage(payload) ?? "Solicitud IBKR falló.", payload);
  }
  return payload;
}

class IbkrApiError extends Error {
  constructor(readonly status: number, message: string, readonly payload: PortfolioStatus) {
    super(message);
  }
}

function formatStatusMessage(status: PortfolioStatus) {
  if (!status.error) return null;
  const primary = status.errorCode ? ` Código: ${status.errorCode}${status.errorStage ? ` (${status.errorStage})` : ""}.` : "";
  const secondary = status.secondaryErrorCode ? ` Lectura posterior: ${status.secondaryErrorCode}${status.secondaryErrorStage ? ` (${status.secondaryErrorStage})` : ""}.` : "";
  return `${status.error}${primary}${secondary}`;
}

function groupPositionValues(positions: Position[]) {
  const totals = new Map<string, number>();
  for (const position of positions) {
    if (!position.positionValue) continue;
    const value = Number(position.positionValue);
    if (Number.isFinite(value)) totals.set(position.currency, (totals.get(position.currency) ?? 0) + value);
  }
  return Array.from(totals, ([currency, amount]) => ({ currency, amount: String(amount) }));
}

function formatMoney(money: Money) {
  return money ? formatMoneyField(money.amount, money.currency) : "—";
}

function formatMoneyField(amount: string | null, currency: string) {
  if (!amount) return "—";
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${currency}`;
  return `${new Intl.NumberFormat("es-CR", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

function formatNumber(value: string | null) {
  if (!value) return "—";
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat("es-CR", { maximumFractionDigits: 6 }).format(number) : value;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
