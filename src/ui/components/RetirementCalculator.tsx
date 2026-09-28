"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { RetirementCalculationService } from "@/application/use-cases/RetirementCalculationService";
import type { SavedRetirementCalculation } from "@/domain/retirementCalculation";
import { createRetirementCalculationRepository } from "@/data/createRetirementCalculationRepository";
import { useCurrencyPreference } from "@/ui/currency";

const percentFormatter = new Intl.NumberFormat("es-CR", {
  maximumFractionDigits: 2,
});

export function RetirementCalculator() {
  const service = useMemo(
    () => new RetirementCalculationService(createRetirementCalculationRepository()),
    [],
  );
  const [description, setDescription] = useState("");
  const [initialBalance, setInitialBalance] = useState(0);
  const [periodicAmount, setPeriodicAmount] = useState(300000);
  const [annualInterestRate, setAnnualInterestRate] = useState(8);
  const [durationYears, setDurationYears] = useState(25);
  const [savedCalculations, setSavedCalculations] = useState<SavedRetirementCalculation[]>([]);
  const [message, setMessage] = useState("Los cálculos son en caliente; solo se guardan cuando vos lo decidís.");
  const { formatCrcAmount } = useCurrencyPreference();

  const currentInput = {
    initialBalance,
    periodicAmount,
    annualInterestRate,
    durationYears,
  };
  const projection = service.calculate(currentInput);

  useEffect(() => {
    service
      .listSavedCalculations()
      .then(setSavedCalculations)
      .catch((error) => {
        setMessage(`No se pudieron cargar los cálculos guardados: ${getErrorMessage(error)}`);
      });
  }, [service]);

  async function saveCalculation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const saved = await service.saveCalculation({
        ...currentInput,
        description,
      });
      setSavedCalculations((current) => saved.isActive
        ? [saved, ...current.map((item) => ({ ...item, isActive: false }))]
        : [saved, ...current]);
      setDescription("");
      setMessage(saved.isActive
        ? "Cálculo de jubilación guardado y activado."
        : "Cálculo de jubilación guardado.");
    } catch (error) {
      setMessage(`No se pudo guardar el cálculo: ${getErrorMessage(error)}`);
    }
  }

  async function activateCalculation(calculation: SavedRetirementCalculation) {
    if (calculation.isActive) {
      return;
    }

    try {
      const activeCalculation = await service.activateCalculation(calculation.id);
      setSavedCalculations((current) => current.map((item) => ({
        ...item,
        isActive: item.id === activeCalculation.id,
      })));
      setMessage(`Escenario activo: ${activeCalculation.description}.`);
    } catch (error) {
      setMessage(`No se pudo activar el cálculo: ${getErrorMessage(error)}`);
    }
  }

  async function deleteCalculation(calculation: SavedRetirementCalculation) {
    const confirmed = window.confirm(
      `¿Eliminar el cálculo "${calculation.description}" por ${formatCrcAmount(calculation.finalAmount)}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await service.deleteCalculation(calculation.id);
      const refreshedCalculations = await service.listSavedCalculations();
      setSavedCalculations(refreshedCalculations);
      setMessage("Cálculo guardado eliminado.");
    } catch (error) {
      setMessage(`No se pudo eliminar el cálculo: ${getErrorMessage(error)}`);
    }
  }

  return (
    <div className="content-stack">
      <section className="page-heading">
        <p className="eyebrow">Jubilación</p>
        <h1>Calculadora de interés compuesto</h1>
        <p>
          Probá distintos escenarios de ahorro para jubilación. Los resultados se recalculan al instante y solo se guardan cuando elegís conservar una combinación.
        </p>
      </section>

      <section className="metrics-grid">
        <article className="metric-card highlight-card">
          <span>Monto proyectado</span>
          <strong>{formatCrcAmount(projection.finalAmount)}</strong>
        </article>
        <article className="metric-card">
          <span>Total aportado</span>
          <strong>{formatCrcAmount(projection.totalContributed)}</strong>
        </article>
        <article className="metric-card">
          <span>Monto mensual estimado</span>
          <strong>{formatCrcAmount(projection.estimatedMonthlyAmount)}</strong>
        </article>
      </section>

      <section className="two-column-grid retirement-grid">
        <form className="card form elevated-card" onSubmit={saveCalculation}>
          <div>
            <p className="eyebrow">Simulación</p>
            <h2>Variables del cálculo</h2>
          </div>

          <label>
            Nombre o descripción del escenario
            <input
              maxLength={120}
              required
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ej. Jubilación conservadora"
            />
          </label>

          <label>
            Balance inicial (CRC)
            <input
              min="0"
              step="0.01"
              type="number"
              value={initialBalance}
              onChange={(event) => setInitialBalance(Number(event.target.value || 0))}
            />
          </label>

          <label>
            Monto periódico mensual (CRC)
            <input
              min="0"
              step="0.01"
              type="number"
              value={periodicAmount}
              onChange={(event) => setPeriodicAmount(Number(event.target.value || 0))}
            />
          </label>

          <label>
            % interés anual
            <input
              min="0"
              step="0.01"
              type="number"
              value={annualInterestRate}
              onChange={(event) => setAnnualInterestRate(Number(event.target.value || 0))}
            />
          </label>

          <label>
            Duración en años
            <input
              min="1"
              step="1"
              type="number"
              value={durationYears}
              onChange={(event) => setDurationYears(Number(event.target.value || 0))}
            />
          </label>

          <button type="submit">Guardar Cálculo de Jubilación</button>
          <p className="message">{message}</p>
        </form>

        <section className="card elevated-card projection-card">
          <div>
            <p className="eyebrow">Resultado</p>
            <h2>Resumen del escenario</h2>
          </div>

          <dl className="summary-list">
            <div>
              <dt>Balance inicial</dt>
              <dd>{formatCrcAmount(initialBalance)}</dd>
            </div>
            <div>
              <dt>Aporte mensual</dt>
              <dd>{formatCrcAmount(periodicAmount)}</dd>
            </div>
            <div>
              <dt>Interés anual</dt>
              <dd>{percentFormatter.format(annualInterestRate)}%</dd>
            </div>
            <div>
              <dt>Duración</dt>
              <dd>{durationYears} años</dd>
            </div>
            <div>
              <dt>Monto mensual estimado</dt>
              <dd>{formatCrcAmount(projection.estimatedMonthlyAmount)}</dd>
            </div>
          </dl>

          <div className="projection-result">
            <span>Meta proyectada</span>
            <strong>{formatCrcAmount(projection.finalAmount)}</strong>
          </div>
        </section>
      </section>

      <section className="card elevated-card">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Guardados</p>
            <h2>Cálculos de jubilación</h2>
          </div>
          <span className="pill">{savedCalculations.length} escenarios</span>
        </div>

        {savedCalculations.length === 0 ? (
          <p className="empty-state">Todavía no hay cálculos guardados.</p>
        ) : (
          <div className="records">
            {savedCalculations.map((calculation) => (
              <article key={calculation.id} className="record retirement-record">
                <div>
                  <div className="record-heading-row">
                    <strong>{calculation.description}</strong>
                    {calculation.isActive ? <span className="pill">Activo</span> : null}
                  </div>
                  <p>
                    Meta {formatCrcAmount(calculation.finalAmount)} · Inicial {formatCrcAmount(calculation.initialBalance)} · Mensual {formatCrcAmount(calculation.periodicAmount)} · {percentFormatter.format(calculation.annualInterestRate)}% · {calculation.durationYears} años
                  </p>
                </div>
                <div className="record-actions">
                  <span className="pill">
                    Mensual estimado: {formatCrcAmount(calculation.estimatedMonthlyAmount)}
                  </span>
                  <button
                    disabled={calculation.isActive}
                    type="button"
                    onClick={() => activateCalculation(calculation)}
                  >
                    {calculation.isActive ? "Activo" : "Marcar activo"}
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => deleteCalculation(calculation)}
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
