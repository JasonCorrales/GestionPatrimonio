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
type AllocationItem = {
  symbol: string;
  amount: number;
  percentage: number;
};
type AllocationGroup = {
  currency: string;
  total: number;
  items: AllocationItem[];
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
  const performanceSummary = useMemo(() => derivePerformanceSummary(snapshot?.nav ?? null, snapshot?.positions ?? []), [snapshot]);
  const allocationsByCurrency = useMemo(() => deriveAllocations(snapshot?.positions ?? []), [snapshot]);

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
          <section className="card compact-stack">
            <div className="section-title-row">
              <div>
                <h2>Resumen del snapshot</h2>
                <p className="muted">Fecha del reporte: <strong>{snapshot.reportDate}</strong>. Última sincronización: {formatDateTime(snapshot.syncedAt)}. Generado por IBKR: {snapshot.generatedAt ? formatDateTime(snapshot.generatedAt) : "—"}.</p>
                <p className="muted">Efectivo: <strong>{formatMoney(snapshot.cash)}</strong></p>
              </div>
            </div>
            <div className="currency-value-grid">
              <Metric label="Valor real liquidable" value={formatMoney(snapshot.nav)} />
              <Metric label="Ganancia actual" value={formatSignedMoney(performanceSummary?.gain ?? null, performanceSummary?.currency ?? snapshot.nav?.currency ?? "")} />
              {valuesByCurrency.map((item) => <Metric key={item.currency} label={`Valor posiciones ${item.currency}`} value={formatMoney(item)} />)}
            </div>
            {!valuesByCurrency.length ? <p className="empty-state">No hay valores de posiciones para agrupar.</p> : null}
          </section>
          <section className="card positions-card">
            <div className="section-title-row"><h2>Posiciones</h2><span className="pill">{snapshot.positions.length} filas</span></div>
            {snapshot.positions.length ? <PositionsTable positions={snapshot.positions} /> : <p className="empty-state">El snapshot no contiene posiciones abiertas.</p>}
            <AllocationDashboard groups={allocationsByCurrency} />
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
  return (
    <div className="positions-table">
      <table>
        <thead>
          <tr>
            <th>Símbolo</th>
            <th>Cantidad</th>
            <th>Precio de mercado</th>
            <th>Precio</th>
            <th>Valor</th>
            <th>Costo</th>
            <th>P/L</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position, index) => (
            <tr key={`${position.symbol ?? "pos"}-${position.currency}-${index}`}>
              <td><strong>{position.symbol ?? "—"}</strong></td>
              <NumericCell value={position.quantity} formatter={formatNumber} />
              <NumericCell value={position.markPrice} formatter={(value) => formatMoneyField(value, position.currency)} />
              <NumericCell value={position.costBasisPrice} formatter={(value) => formatMoneyField(value, position.currency)} />
              <NumericCell value={position.positionValue} formatter={(value) => formatMoneyField(value, position.currency)} />
              <NumericCell value={position.costBasisMoney} formatter={(value) => formatMoneyField(value, position.currency)} />
              <NumericCell value={position.fifoPnlUnrealized} formatter={(value) => formatMoneyField(value, position.currency)} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NumericCell({ value, formatter }: Readonly<{ value: string | null; formatter: (value: string | null) => string }>) {
  return <td className={isNegativeNumericValue(value) ? "numeric-negative" : undefined}>{formatter(value)}</td>;
}

function isNegativeNumericValue(value: string | null) {
  if (!value) return false;
  const number = Number(value);
  return Number.isFinite(number) && number < 0;
}

function AllocationDashboard({ groups }: Readonly<{ groups: AllocationGroup[] }>) {
  return (
    <section className="allocation-dashboard" aria-labelledby="allocation-dashboard-title">
      <div className="allocation-heading">
        <div>
          <h3 id="allocation-dashboard-title">Distribución invertida por acción</h3>
          <p className="muted">Se calcula con valores positivos disponibles y se separa por moneda para no mezclar totales.</p>
        </div>
      </div>
      {groups.length ? (
        <div className="allocation-currency-grid">
          {groups.map((group) => <AllocationCurrencyPanel key={group.currency} group={group} />)}
        </div>
      ) : (
        <p className="empty-state">No hay valores positivos de posiciones para calcular la distribución.</p>
      )}
    </section>
  );
}

function AllocationCurrencyPanel({ group }: Readonly<{ group: AllocationGroup }>) {
  return (
    <article className="allocation-panel" aria-labelledby={`allocation-${group.currency}`}>
      <div className="allocation-chart-wrap">
        <AllocationDonut group={group} />
      </div>
      <div className="allocation-list-wrap">
        <h4 id={`allocation-${group.currency}`}>Moneda {group.currency}</h4>
        <ul className="allocation-list">
          {group.items.map((item, index) => (
            <li key={`${group.currency}-${item.symbol}`}>
              <span className="allocation-swatch" style={{ background: allocationColor(index) }} aria-hidden="true" />
              <div>
                <strong>{item.symbol}</strong>
                <small>{formatMoneyField(String(item.amount), group.currency)} · {formatPercentage(item.percentage)}</small>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function AllocationDonut({ group }: Readonly<{ group: AllocationGroup }>) {
  const size = 320;
  const center = size / 2;
  const radius = 126;
  const strokeWidth = 54;
  const segments = buildAllocationSegments(group.items);

  return (
    <div className="allocation-chart" role="img" aria-label={`Distribución de posiciones en ${group.currency}`}>
      <svg className="allocation-svg" viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle className="allocation-track" cx={center} cy={center} r={radius} strokeWidth={strokeWidth} />
        {segments.map(({ item, start, end }, index) => {
          const label = `${item.symbol}: ${formatPercentage(item.percentage)} · ${formatMoneyField(String(item.amount), group.currency)}`;
          const segmentKey = `${group.currency}-${item.symbol}-segment`;
          const segmentProps = {
            className: "allocation-segment",
            stroke: allocationColor(index),
            strokeWidth,
            tabIndex: 0,
            "aria-label": label,
          };
          return segments.length === 1 ? (
            <circle key={segmentKey} {...segmentProps} cx={center} cy={center} r={radius}>
              <title>{label}</title>
            </circle>
          ) : (
            <path key={segmentKey} {...segmentProps} d={describeDonutSegment(center, center, radius, start, end)}>
              <title>{label}</title>
            </path>
          );
        })}
      </svg>
      <span>{group.currency}<small>{formatMoneyField(String(group.total), group.currency)}</small></span>
    </div>
  );
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

function derivePerformanceSummary(nav: Money, positions: Position[]) {
  if (!nav) return null;
  const currentValue = Number(nav.amount);
  if (!Number.isFinite(currentValue)) return null;
  const invested = positions.reduce((sum, position) => {
    if (position.currency !== nav.currency || !position.costBasisMoney) return sum;
    const cost = Number(position.costBasisMoney);
    return Number.isFinite(cost) && cost > 0 ? sum + cost : sum;
  }, 0);
  return {
    currency: nav.currency,
    currentValue,
    invested,
    gain: invested > 0 ? currentValue - invested : null,
  };
}

function deriveAllocations(positions: Position[]): AllocationGroup[] {
  const totals = new Map<string, Map<string, number>>();
  for (const position of positions) {
    if (!position.positionValue) continue;
    const amount = Number(position.positionValue);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const currency = position.currency || "Sin moneda";
    const symbol = position.symbol?.trim() || "Sin símbolo";
    const currencyTotals = totals.get(currency) ?? new Map<string, number>();
    currencyTotals.set(symbol, (currencyTotals.get(symbol) ?? 0) + amount);
    totals.set(currency, currencyTotals);
  }

  return Array.from(totals, ([currency, amounts]) => {
    const total = Array.from(amounts.values()).reduce((sum, amount) => sum + amount, 0);
    const items = Array.from(amounts, ([symbol, amount]) => ({ symbol, amount, percentage: total > 0 ? (amount / total) * 100 : 0 }))
      .sort((left, right) => right.amount - left.amount || left.symbol.localeCompare(right.symbol));
    return { currency, total, items };
  }).filter((group) => group.total > 0 && group.items.length > 0)
    .sort((left, right) => left.currency.localeCompare(right.currency));
}

function buildAllocationSegments(items: AllocationItem[]) {
  return items.reduce<Array<{ item: AllocationItem; start: number; end: number }>>((segments, item, index) => {
    const start = segments.at(-1)?.end ?? 0;
    const end = index === items.length - 1 ? 100 : start + item.percentage;
    return [...segments, { item, start, end }];
  }, []);
}

function describeDonutSegment(centerX: number, centerY: number, radius: number, startPercent: number, endPercent: number) {
  const start = polarToCartesian(centerX, centerY, radius, percentToDegrees(startPercent));
  const end = polarToCartesian(centerX, centerY, radius, percentToDegrees(endPercent));
  const largeArcFlag = endPercent - startPercent > 50 ? 1 : 0;
  return [`M ${start.x} ${start.y}`, `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`].join(" ");
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function percentToDegrees(percent: number) {
  return Math.min(100, Math.max(0, percent)) * 3.6;
}

function allocationColor(index: number) {
  const colors = ["#2458d3", "#32a6a6", "#f59e0b", "#8b5cf6", "#ef6b61", "#16a34a", "#ec4899", "#64748b"];
  return colors[index % colors.length];
}

function formatMoney(money: Money) {
  return money ? formatMoneyField(money.amount, money.currency) : "—";
}

function formatSignedMoney(amount: number | null, currency: string) {
  if (amount === null || !currency) return "—";
  const sign = amount > 0 ? "+" : "";
  return `${sign}${formatMoneyField(String(amount), currency)}`;
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

function formatPercentage(value: number) {
  return `${new Intl.NumberFormat("es-CR", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
