"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { PatrimonyCategory } from "@/domain/patrimonyCategory";
import {
  PatrimonyRecordService,
  PatrimonyRecordValidationException,
  type PatrimonyRecordView,
} from "@/application/use-cases/PatrimonyRecordService";
import { createPatrimonyRecordRepository, getConfiguredDataSource } from "@/data/createPatrimonyRecordRepository";

const currencyFormatter = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  maximumFractionDigits: 0,
});

export function PatrimonyTracker() {
  const service = useMemo(
    () => new PatrimonyRecordService(createPatrimonyRecordRepository()),
    [],
  );
  const dataSource = getConfiguredDataSource();
  const [recordDate, setRecordDate] = useState(currentDate());
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState("");
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const created = await service.createRecord({
        recordDate,
        categoryId,
        amount,
        notes,
      });
      setRecords((current) => [created, ...current]);
      setAmount(0);
      setNotes("");
      setMessage(
        dataSource === "supabase"
          ? "Patrimony record saved in Supabase."
          : "Patrimony record saved in demo memory.",
      );
    } catch (error) {
      if (error instanceof PatrimonyRecordValidationException) {
        setMessage(error.errors.map((item) => item.message).join(" "));
        return;
      }

      setMessage(`Unexpected error while saving the record: ${getErrorMessage(error)}`);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">MVP</p>
        <h1>Registro mensual de patrimonio</h1>
        <p>
          Capturá una fecha, categoría, monto y nota. La UI usa casos de uso de la capa de aplicación; no conoce Supabase ni detalles de persistencia.
        </p>
      </section>

      <section className="grid">
        <form className="card form" onSubmit={handleSubmit}>
          <h2>Nuevo registro</h2>
          <label>
            Mes
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

          <button type="submit">Guardar registro</button>
          <p className="message">{message}</p>
        </form>

        <section className="card history">
          <h2>Histórico</h2>
          {records.length === 0 ? (
            <p className="muted">Todavía no hay registros.</p>
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
                  <strong>{currencyFormatter.format(record.amount)}</strong>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
