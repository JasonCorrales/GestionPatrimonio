"use client";

import { useEffect, useMemo, useState } from "react";
import { PatrimonyRecordService, type PatrimonyRecordView } from "@/application/use-cases/PatrimonyRecordService";
import { RetirementCalculationService } from "@/application/use-cases/RetirementCalculationService";
import type { SavedRetirementCalculation } from "@/domain/retirementCalculation";
import { createPatrimonyRecordRepository } from "@/data/createPatrimonyRecordRepository";
import { createRetirementCalculationRepository } from "@/data/createRetirementCalculationRepository";
import { useCurrencyPreference } from "@/ui/currency";

const percentFormatter = new Intl.NumberFormat("es-CR", {
  maximumFractionDigits: 1,
});

const chartColors = ["#2458d3", "#32a6a6", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6"];

export function DashboardHome() {
  const patrimonyService = useMemo(
    () => new PatrimonyRecordService(createPatrimonyRecordRepository()),
    [],
  );
  const retirementService = useMemo(
    () => new RetirementCalculationService(createRetirementCalculationRepository()),
    [],
  );
  const [selectedDate, setSelectedDate] = useState(currentDate());
  const [records, setRecords] = useState<PatrimonyRecordView[]>([]);
  const [retirementGoal, setRetirementGoal] = useState<SavedRetirementCalculation | null>(null);
  const [message, setMessage] = useState("Dashboard del mes actual cargado por defecto.");
  const {
    displayCrcAmount,
    displayRecordAmount,
    formatCurrency,
  } = useCurrencyPreference();

  useEffect(() => {
    Promise.all([
      patrimonyService.listRecords(),
      retirementService.listSavedCalculations(),
    ])
      .then(([loadedRecords, savedCalculations]) => {
        setRecords(loadedRecords);
        setRetirementGoal(savedCalculations[0] ?? null);
      })
      .catch((error) => {
        setMessage(`No se pudo cargar el dashboard: ${getErrorMessage(error)}`);
      });
  }, [patrimonyService, retirementService]);

  const selectedMonth = selectedDate.slice(0, 7);
  const cumulativeRecords = records.filter((record) => record.recordDate.slice(0, 7) <= selectedMonth);
  const cumulativeTrend = buildCumulativeTrend(records, displayRecordAmount);
  const distribution = buildDistribution(cumulativeRecords, displayRecordAmount);
  const cumulativeTotal = distribution.reduce((total, item) => total + item.amount, 0);
  const retirementTarget = displayCrcAmount(retirementGoal?.finalAmount ?? 0);
  const retirementProgress = retirementTarget > 0
    ? Math.min(100, (cumulativeTotal / retirementTarget) * 100)
    : 0;
  const retirementGap = Math.max(0, retirementTarget - cumulativeTotal);

  return (
    <div className="content-stack">
      <section className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Resumen patrimonial</h1>
          <p>
            Visualizá tu patrimonio acumulado hasta el mes seleccionado y el avance contra tu última meta de jubilación guardada.
          </p>
        </div>
        <label className="month-filter">
          Fecha a consultar
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value || currentDate())}
          />
          <span>El dashboard acumula registros hasta el mes de la fecha seleccionada.</span>
        </label>
      </section>

      <section className="metrics-grid">
        <article className="metric-card highlight-card">
          <span>Patrimonio acumulado</span>
          <strong>{formatCurrency(cumulativeTotal)}</strong>
        </article>
        <article className="metric-card">
          <span>Meta jubilación</span>
          <strong>{retirementTarget > 0 ? formatCurrency(retirementTarget) : "Sin meta"}</strong>
        </article>
        <article className="metric-card">
          <span>Faltante estimado</span>
          <strong>{retirementTarget > 0 ? formatCurrency(retirementGap) : "—"}</strong>
        </article>
      </section>

      <section className="two-column-grid dashboard-grid">
        <article className="card elevated-card dashboard-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Distribución</p>
              <h2>Patrimonio acumulado por categoría</h2>
            </div>
            <span className="pill">{formatMonth(selectedMonth)}</span>
          </div>

          {distribution.length === 0 ? (
            <p className="empty-state">No hay registros hasta este mes.</p>
          ) : (
            <div className="chart-layout">
              <div
                aria-label="Distribución circular del patrimonio"
                className="donut-chart"
                role="img"
                style={{ background: buildDonutGradient(distribution) }}
              >
                <span>{formatCurrency(cumulativeTotal)}</span>
              </div>

              <div className="chart-legend">
                {distribution.map((item) => (
                  <div key={item.categoryId} className="legend-item">
                    <span style={{ background: item.color }} />
                    <div>
                      <strong>{item.categoryName}</strong>
                      <small>
                        {formatCurrency(item.amount)} · {percentFormatter.format(item.percentage)}%
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        <article className="card elevated-card dashboard-card">
          <div>
            <p className="eyebrow">Jubilación</p>
            <h2>Progreso hacia la meta</h2>
          </div>

          {retirementGoal ? (
            <div className="progress-panel">
              <div className="progress-summary">
                <span>Llevás</span>
                <strong>{formatCurrency(cumulativeTotal)}</strong>
                <small>de {formatCurrency(retirementTarget)}</small>
              </div>
              <div className="progress-track">
                <span style={{ width: `${retirementProgress}%` }} />
              </div>
              <div className="progress-footer">
                <strong>{percentFormatter.format(retirementProgress)}%</strong>
                <span>Faltan {formatCurrency(retirementGap)}</span>
              </div>
              <p className="message">
                Meta tomada del último cálculo guardado el {formatDate(retirementGoal.createdAt)}.
              </p>
            </div>
          ) : (
            <p className="empty-state">
              Guardá un cálculo en Jubilación para activar esta barra de progreso.
            </p>
          )}
        </article>
      </section>

      <section className="card elevated-card dashboard-card line-chart-card">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Evolución acumulada</p>
            <h2>Patrimonio acumulado por mes</h2>
          </div>
          {cumulativeTrend.length > 0 ? (
            <span className="pill">
              {formatMonth(cumulativeTrend[0].month)} - {formatMonth(cumulativeTrend[cumulativeTrend.length - 1].month)}
            </span>
          ) : null}
        </div>

        {cumulativeTrend.length === 0 ? (
          <p className="empty-state">No hay registros para graficar la evolución acumulada.</p>
        ) : (
          <div className="line-chart-layout">
            <CumulativeLineChart
              formatCurrency={formatCurrency}
              points={cumulativeTrend}
            />
            <div className="line-chart-summary">
              <div>
                <span>Total acumulado</span>
                <strong>{formatCurrency(cumulativeTrend[cumulativeTrend.length - 1].totalCumulativeAmount)}</strong>
                <small>Incluye registros sin tipo de movimiento.</small>
              </div>
              <div>
                <span>Aportes acumulados</span>
                <strong>{formatCurrency(cumulativeTrend[cumulativeTrend.length - 1].contributionCumulativeAmount)}</strong>
                <small>
                  {formatSharePercentage(
                    cumulativeTrend[cumulativeTrend.length - 1].contributionCumulativeAmount,
                    cumulativeTrend[cumulativeTrend.length - 1].totalCumulativeAmount,
                  )} del total acumulado.
                </small>
              </div>
              <div>
                <span>Intereses acumulados</span>
                <strong>{formatCurrency(cumulativeTrend[cumulativeTrend.length - 1].interestCumulativeAmount)}</strong>
                <small>
                  {formatSharePercentage(
                    cumulativeTrend[cumulativeTrend.length - 1].interestCumulativeAmount,
                    cumulativeTrend[cumulativeTrend.length - 1].totalCumulativeAmount,
                  )} del total acumulado.
                </small>
              </div>
            </div>
          </div>
        )}
      </section>

      <p className="message">{message}</p>
    </div>
  );
}

type DistributionItem = {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  color: string;
};

type CumulativeTrendPoint = {
  month: string;
  totalMonthlyAmount: number;
  contributionMonthlyAmount: number;
  interestMonthlyAmount: number;
  totalCumulativeAmount: number;
  contributionCumulativeAmount: number;
  interestCumulativeAmount: number;
};

type CumulativeLineChartProps = {
  points: CumulativeTrendPoint[];
  formatCurrency: (amount: number) => string;
};

function CumulativeLineChart({ points, formatCurrency }: CumulativeLineChartProps) {
  const width = 720;
  const height = 280;
  const padding = 38;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const maxAmount = Math.max(
    ...points.flatMap((point) => [
      point.totalCumulativeAmount,
      point.contributionCumulativeAmount,
      point.interestCumulativeAmount,
    ]),
  );
  const safeMaxAmount = maxAmount > 0 ? maxAmount : 1;
  const coordinates = points.map((point, index) => {
    const x = points.length === 1
      ? padding + chartWidth / 2
      : padding + (index / (points.length - 1)) * chartWidth;

    return {
      ...point,
      x,
      totalY: yForAmount(point.totalCumulativeAmount, safeMaxAmount, padding, chartHeight),
      contributionY: yForAmount(point.contributionCumulativeAmount, safeMaxAmount, padding, chartHeight),
      classifiedY: yForAmount(
        point.contributionCumulativeAmount + point.interestCumulativeAmount,
        safeMaxAmount,
        padding,
        chartHeight,
      ),
    };
  });
  const totalLinePoints = coordinates.map((point) => `${point.x},${point.totalY}`).join(" ");
  const contributionAreaPoints = buildAreaToBaselinePoints(
    coordinates.map((point) => ({ x: point.x, y: point.contributionY })),
    height - padding,
  );
  const interestAreaPoints = buildBandAreaPoints(
    coordinates.map((point) => ({ x: point.x, y: point.classifiedY })),
    coordinates.map((point) => ({ x: point.x, y: point.contributionY })),
  );
  const totalAreaPoints = buildAreaToBaselinePoints(
    coordinates.map((point) => ({ x: point.x, y: point.totalY })),
    height - padding,
  );
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  return (
    <div className="line-chart-shell">
      <svg
        aria-label={`Patrimonio acumulado desde ${formatMonth(firstPoint.month)} hasta ${formatMonth(lastPoint.month)}`}
        className="line-chart"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <line className="line-chart-axis" x1={padding} x2={padding} y1={padding} y2={height - padding} />
        <line className="line-chart-axis" x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
        <polygon className="line-chart-area total-area" points={totalAreaPoints} />
        <polygon className="line-chart-area contribution-area" points={contributionAreaPoints} />
        <polygon className="line-chart-area interest-area" points={interestAreaPoints} />
        <polyline className="line-chart-line total-line" points={totalLinePoints} />
        {coordinates.map((point) => (
          <circle key={point.month} className="line-chart-point total-point" cx={point.x} cy={point.totalY} r="4">
            <title>
              {formatMonth(point.month)}: {formatCurrency(point.totalCumulativeAmount)} total acumulado; {formatCurrency(point.contributionCumulativeAmount)} en aportes y {formatCurrency(point.interestCumulativeAmount)} en intereses.
            </title>
          </circle>
        ))}
        <text className="line-chart-label" x={padding} y={height - 10}>
          {formatMonth(firstPoint.month)}
        </text>
        <text className="line-chart-label" textAnchor="end" x={width - padding} y={height - 10}>
          {formatMonth(lastPoint.month)}
        </text>
        <text className="line-chart-label" x={padding} y={padding - 14}>
          {formatCurrency(maxAmount)}
        </text>
      </svg>
      <div className="line-chart-legend" aria-label="Leyenda de evolución acumulada">
        <span><i className="total-line-swatch" /> Patrimonio acumulado</span>
        <span><i className="contribution-line-swatch" /> Sombreado Aporte</span>
        <span><i className="interest-line-swatch" /> Sombreado Interés</span>
      </div>
    </div>
  );
}

function yForAmount(amount: number, maxAmount: number, padding: number, chartHeight: number) {
  return padding + chartHeight - (amount / maxAmount) * chartHeight;
}

function buildAreaToBaselinePoints(points: { x: number; y: number }[], baselineY: number) {
  return [
    `${points[0].x},${baselineY}`,
    ...points.map((point) => `${point.x},${point.y}`),
    `${points[points.length - 1].x},${baselineY}`,
  ].join(" ");
}

function buildBandAreaPoints(topPoints: { x: number; y: number }[], bottomPoints: { x: number; y: number }[]) {
  return [
    ...topPoints.map((point) => `${point.x},${point.y}`),
    ...[...bottomPoints].reverse().map((point) => `${point.x},${point.y}`),
  ].join(" ");
}

function buildDistribution(
  records: PatrimonyRecordView[],
  displayRecordAmount: (record: PatrimonyRecordView) => number,
): DistributionItem[] {
  const totals = new Map<string, { categoryName: string; amount: number }>();

  for (const record of records) {
    const current = totals.get(record.category.id) ?? {
      categoryName: record.category.name,
      amount: 0,
    };
    totals.set(record.category.id, {
      categoryName: current.categoryName,
      amount: current.amount + displayRecordAmount(record),
    });
  }

  const total = [...totals.values()].reduce((sum, item) => sum + item.amount, 0);

  return [...totals.entries()]
    .map(([categoryId, item], index) => ({
      categoryId,
      categoryName: item.categoryName,
      amount: item.amount,
      percentage: total > 0 ? (item.amount / total) * 100 : 0,
      color: chartColors[index % chartColors.length],
    }))
    .sort((left, right) => right.amount - left.amount);
}

function buildCumulativeTrend(
  records: PatrimonyRecordView[],
  displayRecordAmount: (record: PatrimonyRecordView) => number,
): CumulativeTrendPoint[] {
  if (records.length === 0) {
    return [];
  }

  const monthlyTotals = new Map<string, { total: number; contribution: number; interest: number }>();
  const recordMonths = records.map((record) => record.recordDate.slice(0, 7)).sort();
  const firstMonth = recordMonths[0];
  const lastMonth = recordMonths[recordMonths.length - 1];

  for (const record of records) {
    const month = record.recordDate.slice(0, 7);
    const amount = displayRecordAmount(record);
    const current = monthlyTotals.get(month) ?? { total: 0, contribution: 0, interest: 0 };

    monthlyTotals.set(month, {
      total: current.total + amount,
      contribution: current.contribution + (record.movementType === "contribution" ? amount : 0),
      interest: current.interest + (record.movementType === "interest" ? amount : 0),
    });
  }

  let totalCumulativeAmount = 0;
  let contributionCumulativeAmount = 0;
  let interestCumulativeAmount = 0;

  return enumerateMonths(firstMonth, lastMonth).map((month) => {
    const monthlyAmount = monthlyTotals.get(month) ?? { total: 0, contribution: 0, interest: 0 };
    totalCumulativeAmount += monthlyAmount.total;
    contributionCumulativeAmount += monthlyAmount.contribution;
    interestCumulativeAmount += monthlyAmount.interest;

    return {
      month,
      totalMonthlyAmount: monthlyAmount.total,
      contributionMonthlyAmount: monthlyAmount.contribution,
      interestMonthlyAmount: monthlyAmount.interest,
      totalCumulativeAmount,
      contributionCumulativeAmount,
      interestCumulativeAmount,
    };
  });
}

function enumerateMonths(firstMonth: string, lastMonth: string) {
  const months: string[] = [];
  const cursor = new Date(`${firstMonth}-01T00:00:00`);
  const last = new Date(`${lastMonth}-01T00:00:00`);

  while (cursor <= last) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function buildDonutGradient(distribution: DistributionItem[]) {
  let cursor = 0;
  const segments = distribution.map((item) => {
    const start = cursor;
    const end = cursor + item.percentage;
    cursor = end;
    return `${item.color} ${start}% ${end}%`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("es-CR", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}-01T00:00:00`));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatSharePercentage(amount: number, total: number) {
  if (total <= 0) {
    return "0%";
  }

  return `${percentFormatter.format((amount / total) * 100)}%`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
