"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { PatrimonyCategory } from "@/domain/patrimonyCategory";
import {
  PatrimonyRecordService,
  type PatrimonyRecordView,
} from "@/application/use-cases/PatrimonyRecordService";
import { createPatrimonyRecordRepository } from "@/data/createPatrimonyRecordRepository";

export function CategoryMaintenance() {
  const service = useMemo(
    () => new PatrimonyRecordService(createPatrimonyRecordRepository()),
    [],
  );
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<PatrimonyCategory[]>([]);
  const [records, setRecords] = useState<PatrimonyRecordView[]>([]);
  const [message, setMessage] = useState("Administrá las categorías disponibles para tus registros.");

  useEffect(() => {
    Promise.all([service.listCategories(), service.listRecords()])
      .then(([loadedCategories, loadedRecords]) => {
        setCategories(loadedCategories);
        setRecords(loadedRecords);
      })
      .catch((error) => {
        setMessage(`No se pudieron cargar las categorías: ${getErrorMessage(error)}`);
      });
  }, [service]);

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
        setMessage("Categoría actualizada.");
        return;
      }

      const created = await service.createCategory({ name: categoryName });
      setCategories((current) => sortCategories([...current, created]));
      resetCategoryForm();
      setMessage("Categoría creada.");
    } catch (error) {
      setMessage(`Error al guardar la categoría: ${getErrorMessage(error)}`);
    }
  }

  function startEditingCategory(category: PatrimonyCategory) {
    setEditingCategoryId(category.id);
    setCategoryName(category.name);
    setMessage("Editando la categoría seleccionada.");
  }

  async function deleteCategory(category: PatrimonyCategory) {
    if (categoryHasRecords(category.id, records)) {
      setMessage("No se puede eliminar una categoría con registros asociados.");
      return;
    }

    const confirmed = window.confirm(`¿Eliminar la categoría ${category.name}?`);

    if (!confirmed) {
      return;
    }

    try {
      await service.deleteCategory(category.id);
      setCategories((current) => current.filter((item) => item.id !== category.id));

      if (editingCategoryId === category.id) {
        resetCategoryForm();
      }

      setMessage("Categoría eliminada.");
    } catch (error) {
      setMessage(`Error al eliminar la categoría: ${getErrorMessage(error)}`);
    }
  }

  function resetCategoryForm() {
    setEditingCategoryId(null);
    setCategoryName("");
  }

  return (
    <div className="content-stack">
      <section className="page-heading">
        <p className="eyebrow">Categorías</p>
        <h1>Mantenimiento de categorías</h1>
        <p>
          Ordená el catálogo que usás al registrar patrimonio. Las categorías con registros asociados quedan protegidas contra eliminación.
        </p>
      </section>

      <section className="two-column-grid category-page-grid">
        <form className="card form elevated-card" onSubmit={handleCategorySubmit}>
          <div>
            <p className="eyebrow">Formulario</p>
            <h2>{editingCategoryId ? "Editar categoría" : "Nueva categoría"}</h2>
          </div>

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
          <p className="message">{message}</p>
        </form>

        <section className="card elevated-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Catálogo</p>
              <h2>Categorías disponibles</h2>
            </div>
            <span className="pill">{categories.length} categorías</span>
          </div>

          <div className="category-list">
            {categories.map((category) => (
              <article key={category.id} className="category-item">
                <div>
                  <strong>{category.name}</strong>
                  <p>{recordsByCategory(category.id, records)} registros asociados</p>
                </div>
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
      </section>
    </div>
  );
}

function sortCategories(categories: PatrimonyCategory[]) {
  return [...categories].sort((left, right) =>
    left.displayOrder - right.displayOrder,
  );
}

function categoryHasRecords(categoryId: string, records: PatrimonyRecordView[]) {
  return records.some((record) => record.category.id === categoryId);
}

function recordsByCategory(categoryId: string, records: PatrimonyRecordView[]) {
  return records.filter((record) => record.category.id === categoryId).length;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
