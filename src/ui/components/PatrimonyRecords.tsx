"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { PatrimonyMovementType } from "@/domain/monthlyPatrimonyRecord";
import type { PatrimonyCategory } from "@/domain/patrimonyCategory";
import {
  PatrimonyRecordService,
  PatrimonyRecordValidationException,
  type PatrimonyRecordView,
} from "@/application/use-cases/PatrimonyRecordService";
import { createPatrimonyRecordRepository, getConfiguredDataSource } from "@/data/createPatrimonyRecordRepository";
import { useCurrencyPreference } from "@/ui/currency";
import { PatrimonyBulkImport } from "./PatrimonyBulkImport";

type RecordsTab = "entry" | "history";
type MovementTypeFormValue = PatrimonyMovementType | "";

export function PatrimonyRecords() {
  const service = useMemo(
    () => new PatrimonyRecordService(createPatrimonyRecordRepository()),
    [],
  );
  const dataSource = getConfiguredDataSource();
  const [activeTab, setActiveTab] = useState<RecordsTab>("entry");
  const [recordDate, setRecordDate] = useState(currentDate());
  const [categoryId, setCategoryId] = useState("");
  const [amountCrc, setAmountCrc] = useState(0);
  const [amountUsd, setAmountUsd] = useState("");
  const [movementType, setMovementType] = useState<MovementTypeFormValue>("");
  const [notes, setNotes] = useState("");
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [categories, setCategories] = useState<PatrimonyCategory[]>([]);
  const [records, setRecords] = useState<PatrimonyRecordView[]>([]);
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState("all");
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyPage, setHistoryPage] = useState(1);
  const { displayRecordAmount, formatCurrency, formatRecordAmount, formatUsd } = useCurrencyPreference();
  const [message, setMessage] = useState(
    dataSource === "supabase"
      ? "Supabase mode enabled. Records are stored in the configured project."
      : "Demo mode: data is stored in memory until Supabase is enabled.",
  );

  useEffect(() => {
    Promise.all([service.listCategories(), service.listRecords()])
      .then(([loadedCategories, loadedRecords]) => {
        setCategories(loadedCategories);
        setRecords(loadedRecords);
        setCategoryId((current) => current || loadedCategories[0]?.id || "");
      })
      .catch((error) => {
        setMessage(`Could not load records: ${getErrorMessage(error)}`);
      });
  }, [service]);

  const filteredHistoryRecords = useMemo(
    () => records.filter((record) => {
      const matchesDate = historyDateFilter === "" || record.recordDate === historyDateFilter;
      const matchesCategory = historyCategoryFilter === "all" || record.category.id === historyCategoryFilter;

      return matchesDate && matchesCategory;
    }),
    [historyCategoryFilter, historyDateFilter, records],
  );
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistoryRecords.length / historyPageSize));
  const currentHistoryPage = Math.min(historyPage, historyTotalPages);
  const historyPageStartIndex = (currentHistoryPage - 1) * historyPageSize;
  const paginatedHistoryRecords = filteredHistoryRecords.slice(
    historyPageStartIndex,
    historyPageStartIndex + historyPageSize,
  );
  const historyRangeStart = filteredHistoryRecords.length === 0 ? 0 : historyPageStartIndex + 1;
  const historyRangeEnd = Math.min(historyPageStartIndex + historyPageSize, filteredHistoryRecords.length);

  async function handleRecordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      if (editingRecordId) {
        const updated = await service.updateRecord(editingRecordId, {
          recordDate,
          categoryId,
          amountCrc,
          amountUsd: parseOptionalNumber(amountUsd),
          movementType: parseMovementType(movementType),
          notes,
        });
        setRecords((current) => sortRecords(current.map((record) =>
          record.id === updated.id ? updated : record,
        )));
        setHistoryPage(1);
        resetRecordForm();
        setActiveTab("history");
        setMessage("Registro actualizado.");
        return;
      }

      const created = await service.createRecord({
        recordDate,
        categoryId,
        amountCrc,
        amountUsd: parseOptionalNumber(amountUsd),
        movementType: parseMovementType(movementType),
        notes,
      });
      setRecords((current) => sortRecords([created, ...current]));
      setHistoryPage(1);
      resetRecordForm({ keepCategory: true });
      setMessage(
        dataSource === "supabase"
          ? "Registro guardado en Supabase."
          : "Registro guardado en memoria demo.",
      );
    } catch (error) {
      if (error instanceof PatrimonyRecordValidationException) {
        setMessage(error.errors.map((item) => item.message).join(" "));
        return;
      }

      setMessage(`Error al guardar el registro: ${getErrorMessage(error)}`);
    }
  }

  function startEditingRecord(record: PatrimonyRecordView) {
    setEditingRecordId(record.id);
    setRecordDate(record.recordDate);
    setCategoryId(record.category.id);
    setAmountCrc(record.amountCrc);
    setAmountUsd(record.amountUsd?.toString() ?? "");
    setMovementType(record.movementType ?? "");
    setNotes(record.notes ?? "");
    setActiveTab("entry");
    setMessage("Editando el registro seleccionado.");
  }

  function startDuplicatingRecord(record: PatrimonyRecordView) {
    setEditingRecordId(null);
    setRecordDate(record.recordDate);
    setCategoryId(record.category.id);
    setAmountCrc(record.amountCrc);
    setAmountUsd(record.amountUsd?.toString() ?? "");
    setMovementType(record.movementType ?? "");
    setNotes(record.notes ?? "");
    setActiveTab("entry");
    setMessage("Registro duplicado en el formulario. Revisá los datos y guardalo como nuevo registro.");
  }

  async function deleteRecord(record: PatrimonyRecordView) {
    const confirmed = window.confirm(
      `¿Eliminar el registro de ${record.category.name} del ${formatDate(record.recordDate)}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await service.deleteRecord(record.id);
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setHistoryPage(1);

      if (editingRecordId === record.id) {
        resetRecordForm();
      }

      setMessage("Registro eliminado.");
    } catch (error) {
      setMessage(`Error al eliminar el registro: ${getErrorMessage(error)}`);
    }
  }

  function resetRecordForm(options?: { keepCategory?: boolean }) {
    setEditingRecordId(null);
    setRecordDate(currentDate());
    setCategoryId((current) =>
      options?.keepCategory ? current : categories[0]?.id || "",
    );
    setAmountCrc(0);
    setAmountUsd("");
    setMovementType("");
    setNotes("");
  }

  return (
    <div className="content-stack">
      <section className="page-heading">
        <p className="eyebrow">Registros</p>
        <h1>Registro mensual de patrimonio</h1>
        <p>
          Capturá una fecha, categoría, tipo de movimiento, monto y nota. También podés importar registros desde una plantilla de Excel.
        </p>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>Total registrado</span>
          <strong>{formatRecordTotal(records, displayRecordAmount, formatCurrency)}</strong>
        </article>
        <article className="metric-card">
          <span>Registros</span>
          <strong>{records.length}</strong>
        </article>
        <article className="metric-card">
          <span>Categorías activas</span>
          <strong>{categories.length}</strong>
        </article>
      </section>

      <div className="tabs" role="tablist" aria-label="Secciones de registros">
        <button
          aria-selected={activeTab === "entry"}
          className={activeTab === "entry" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("entry")}
          role="tab"
          type="button"
        >
          Registro y carga masiva
        </button>
        <button
          aria-selected={activeTab === "history"}
          className={activeTab === "history" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("history")}
          role="tab"
          type="button"
        >
          Histórico
        </button>
      </div>

      {activeTab === "entry" ? (
        <section className="two-column-grid">
          <form className="card form elevated-card" onSubmit={handleRecordSubmit}>
            <div>
              <p className="eyebrow">Formulario</p>
              <h2>{editingRecordId ? "Editar registro" : "Nuevo registro"}</h2>
            </div>

            <label>
              Fecha
              <input
                type="date"
                value={recordDate}
                onChange={(event) => setRecordDate(event.target.value)}
              />
            </label>

            <label>
              Categoría
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Tipo de movimiento
              <select
                required
                value={movementType}
                onChange={(event) => setMovementType(event.target.value as MovementTypeFormValue)}
              >
                <option value="">Seleccioná un tipo</option>
                <option value="contribution">Aporte</option>
                <option value="interest">Interés</option>
              </select>
            </label>

            <label>
              Monto CRC
              <input
                min="0"
                step="0.01"
                type="number"
                value={amountCrc}
                onChange={(event) => setAmountCrc(Number(event.target.value || 0))}
              />
            </label>

            <label>
              Monto USD (opcional)
              <input
                min="0"
                step="0.01"
                type="number"
                value={amountUsd}
                onChange={(event) => setAmountUsd(event.target.value)}
                placeholder="Ej. 100"
              />
            </label>

            <label>
              Nota
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
            </label>

            <div className="form-actions">
              <button type="submit">
                {editingRecordId ? "Actualizar registro" : "Guardar registro"}
              </button>
              {editingRecordId ? (
                <button className="secondary-button" type="button" onClick={() => resetRecordForm()}>
                  Cancelar edición
                </button>
              ) : null}
            </div>
            <p className="message">{message}</p>
          </form>

          <div className="content-stack compact-stack">
            <PatrimonyBulkImport
              categories={categories}
              onImported={(importedRecords) => {
                setRecords((current) => sortRecords([...importedRecords, ...current]));
                setHistoryPage(1);
                setMessage(`${importedRecords.length} registros importados desde Excel.`);
                setActiveTab("history");
              }}
              service={service}
            />
          </div>
        </section>
      ) : (
        <section className="card history elevated-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Histórico</p>
              <h2>Movimientos registrados</h2>
            </div>
            <span className="pill">{records.length} registros</span>
          </div>
          {records.length === 0 ? (
            <p className="empty-state">Todavía no hay registros.</p>
          ) : (
            <>
              <div className="history-controls form">
                <label>
                  Filtrar por fecha
                  <input
                    type="date"
                    value={historyDateFilter}
                    onChange={(event) => {
                      setHistoryDateFilter(event.target.value);
                      setHistoryPage(1);
                    }}
                  />
                </label>
                <label>
                  Filtrar por categoría
                  <select
                    value={historyCategoryFilter}
                    onChange={(event) => {
                      setHistoryCategoryFilter(event.target.value);
                      setHistoryPage(1);
                    }}
                  >
                    <option value="all">Todas las categorías</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Registros por página
                  <select
                    value={historyPageSize}
                    onChange={(event) => {
                      setHistoryPageSize(Number(event.target.value));
                      setHistoryPage(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>

              <div className="history-summary-row">
                <span>
                  Mostrando {historyRangeStart}-{historyRangeEnd} de {filteredHistoryRecords.length} filtrados
                  {filteredHistoryRecords.length !== records.length ? ` (${records.length} totales)` : ""}
                </span>
                <span>Página {currentHistoryPage} de {historyTotalPages}</span>
              </div>

              {filteredHistoryRecords.length === 0 ? (
                <p className="empty-state">No hay registros que coincidan con los filtros seleccionados.</p>
              ) : (
                <>
                  <div className="records">
                    {paginatedHistoryRecords.map((record) => (
                      <article key={record.id} className="record">
                        <div>
                          <strong>{formatDate(record.recordDate)}</strong>
                          <p>
                            {record.category.name} · {formatMovementType(record.movementType)} · {record.notes ?? "Sin nota"}
                          </p>
                        </div>
                        <div className="record-actions">
                          <strong>{formatRecordAmount(record)}</strong>
                          {record.amountUsd !== null ? <span>Monto USD fuente {formatUsd(record.amountUsd)}</span> : null}
                          <button type="button" onClick={() => startEditingRecord(record)}>
                            Editar
                          </button>
                          <button type="button" onClick={() => startDuplicatingRecord(record)}>
                            Duplicar
                          </button>
                          <button
                            className="danger-button"
                            type="button"
                            onClick={() => deleteRecord(record)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="pagination-controls">
                    <button
                      className="secondary-button"
                      disabled={currentHistoryPage === 1}
                      type="button"
                      onClick={() => setHistoryPage(Math.max(1, currentHistoryPage - 1))}
                    >
                      Anterior
                    </button>
                    <span>
                      Página {currentHistoryPage} de {historyTotalPages}
                    </span>
                    <button
                      className="secondary-button"
                      disabled={currentHistoryPage === historyTotalPages}
                      type="button"
                      onClick={() => setHistoryPage(Math.min(historyTotalPages, currentHistoryPage + 1))}
                    >
                      Siguiente
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function sortRecords(records: PatrimonyRecordView[]) {
  return [...records].sort((left, right) =>
    right.recordDate.localeCompare(left.recordDate),
  );
}

function formatRecordTotal(
  records: PatrimonyRecordView[],
  displayRecordAmount: (record: PatrimonyRecordView) => number,
  formatCurrency: (amount: number) => string,
) {
  const total = records.reduce((sum, record) => sum + displayRecordAmount(record), 0);

  return formatCurrency(total);
}

function parseOptionalNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function parseMovementType(value: MovementTypeFormValue): PatrimonyMovementType {
  if (value === "") {
    throw new PatrimonyRecordValidationException([
      { field: "movementType", message: "Tipo de movimiento es requerido." },
    ]);
  }

  return value;
}

function formatMovementType(value: PatrimonyMovementType | null) {
  if (value === "contribution") {
    return "Aporte";
  }

  if (value === "interest") {
    return "Interés";
  }

  return "Tipo pendiente";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
