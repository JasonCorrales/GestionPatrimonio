"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { PatrimonyCategory } from "@/domain/patrimonyCategory";
import {
  PatrimonyRecordService,
  PatrimonyRecordValidationException,
  type PatrimonyRecordView,
} from "@/application/use-cases/PatrimonyRecordService";
import { createPatrimonyRecordRepository, getConfiguredDataSource } from "@/data/createPatrimonyRecordRepository";
import { PatrimonyBulkImport } from "./PatrimonyBulkImport";

const currencyFormatter = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  maximumFractionDigits: 0,
});

type RecordsTab = "entry" | "history";

export function PatrimonyRecords() {
  const service = useMemo(
    () => new PatrimonyRecordService(createPatrimonyRecordRepository()),
    [],
  );
  const dataSource = getConfiguredDataSource();
  const [activeTab, setActiveTab] = useState<RecordsTab>("entry");
  const [recordDate, setRecordDate] = useState(currentDate());
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [categories, setCategories] = useState<PatrimonyCategory[]>([]);
  const [records, setRecords] = useState<PatrimonyRecordView[]>([]);
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

  async function handleRecordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      if (editingRecordId) {
        const updated = await service.updateRecord(editingRecordId, {
          recordDate,
          categoryId,
          amount,
          notes,
        });
        setRecords((current) => sortRecords(current.map((record) =>
          record.id === updated.id ? updated : record,
        )));
        resetRecordForm();
        setActiveTab("history");
        setMessage("Registro actualizado.");
        return;
      }

      const created = await service.createRecord({
        recordDate,
        categoryId,
        amount,
        notes,
      });
      setRecords((current) => sortRecords([created, ...current]));
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
    setAmount(record.amount);
    setNotes(record.notes ?? "");
    setActiveTab("entry");
    setMessage("Editando el registro seleccionado.");
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
    setAmount(0);
    setNotes("");
  }

  return (
    <div className="content-stack">
      <section className="page-heading">
        <p className="eyebrow">Registros</p>
        <h1>Registro mensual de patrimonio</h1>
        <p>
          Capturá una fecha, categoría, monto y nota. También podés importar registros desde una plantilla de Excel.
        </p>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>Total registrado</span>
          <strong>{currencyFormatter.format(totalAmount(records))}</strong>
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
              Monto
              <input
                min="0"
                step="0.01"
                type="number"
                value={amount}
                onChange={(event) => setAmount(Number(event.target.value || 0))}
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
            <div className="records">
              {records.map((record) => (
                <article key={record.id} className="record">
                  <div>
                    <strong>{formatDate(record.recordDate)}</strong>
                    <p>
                      {record.category.name} · {record.notes ?? "Sin nota"}
                    </p>
                  </div>
                  <div className="record-actions">
                    <strong>{currencyFormatter.format(record.amount)}</strong>
                    <button type="button" onClick={() => startEditingRecord(record)}>
                      Editar
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

function totalAmount(records: PatrimonyRecordView[]) {
  return records.reduce((total, record) => total + record.amount, 0);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
