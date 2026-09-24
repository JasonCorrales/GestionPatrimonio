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
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
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
        setMessage("Patrimony record updated.");
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

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      if (editingCategoryId) {
        const updated = await service.updateCategory(editingCategoryId, {
          name: categoryName,
        });
        setCategories((current) => sortCategories(current.map((category) =>
          category.id === updated.id ? updated : category,
        )));
        setRecords((current) => current.map((record) =>
          record.category.id === updated.id
            ? { ...record, category: updated }
            : record,
        ));
        resetCategoryForm();
        setMessage("Category updated.");
        return;
      }

      const created = await service.createCategory({ name: categoryName });
      setCategories((current) => sortCategories([...current, created]));
      setCategoryId((current) => current || created.id);
      resetCategoryForm();
      setMessage("Category created.");
    } catch (error) {
      setMessage(`Unexpected error while saving the category: ${getErrorMessage(error)}`);
    }
  }

  function startEditingRecord(record: PatrimonyRecordView) {
    setEditingRecordId(record.id);
    setRecordDate(record.recordDate);
    setCategoryId(record.category.id);
    setAmount(record.amount);
    setNotes(record.notes ?? "");
    setMessage("Editing selected patrimony record.");
  }

  function startEditingCategory(category: PatrimonyCategory) {
    setEditingCategoryId(category.id);
    setCategoryName(category.name);
    setMessage("Editing selected category.");
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

      setMessage("Patrimony record deleted.");
    } catch (error) {
      setMessage(`Unexpected error while deleting the record: ${getErrorMessage(error)}`);
    }
  }

  async function deleteCategory(category: PatrimonyCategory) {
    if (categoryHasRecords(category.id, records)) {
      setMessage("No se puede eliminar una categoría con registros asociados.");
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar la categoría ${category.name}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await service.deleteCategory(category.id);
      const nextCategories = categories.filter((item) => item.id !== category.id);
      setCategories(nextCategories);

      if (categoryId === category.id) {
        setCategoryId(nextCategories[0]?.id || "");
      }

      if (editingCategoryId === category.id) {
        resetCategoryForm();
      }

      setMessage("Category deleted.");
    } catch (error) {
      setMessage(`Unexpected error while deleting the category: ${getErrorMessage(error)}`);
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

  function resetCategoryForm() {
    setEditingCategoryId(null);
    setCategoryName("");
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
        <form className="card form" onSubmit={handleRecordSubmit}>
          <h2>{editingRecordId ? "Editar registro" : "Nuevo registro"}</h2>
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
      </section>

      <section className="card category-maintenance">
        <div>
          <p className="eyebrow">Categorías</p>
          <h2>Mantenimiento de categorías</h2>
        </div>

        <form className="form compact-form" onSubmit={handleCategorySubmit}>
          <label>
            Nombre de categoría
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Ej. Bienes raíces"
            />
          </label>
          <div className="form-actions">
            <button type="submit">
              {editingCategoryId ? "Actualizar categoría" : "Agregar categoría"}
            </button>
            {editingCategoryId ? (
              <button className="secondary-button" type="button" onClick={resetCategoryForm}>
                Cancelar edición
              </button>
            ) : null}
          </div>
        </form>

        <div className="category-list">
          {categories.map((category) => (
            <article key={category.id} className="category-item">
              <span>{category.name}</span>
              <div className="record-actions">
                <button type="button" onClick={() => startEditingCategory(category)}>
                  Editar
                </button>
                <button
                  className="danger-button"
                  disabled={categoryHasRecords(category.id, records)}
                  title={
                    categoryHasRecords(category.id, records)
                      ? "No se puede eliminar una categoría con registros asociados."
                      : undefined
                  }
                  type="button"
                  onClick={() => deleteCategory(category)}
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
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

function sortRecords(records: PatrimonyRecordView[]) {
  return [...records].sort((left, right) =>
    right.recordDate.localeCompare(left.recordDate),
  );
}

function sortCategories(categories: PatrimonyCategory[]) {
  return [...categories].sort((left, right) =>
    left.displayOrder - right.displayOrder,
  );
}

function categoryHasRecords(categoryId: string, records?: PatrimonyRecordView[]) {
  return (records ?? []).some((record) => record.category.id === categoryId);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
