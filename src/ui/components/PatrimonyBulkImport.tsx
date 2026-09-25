"use client";

import { ChangeEvent, useState } from "react";
import { readSheet } from "read-excel-file/browser";
import type { PatrimonyRecordInput } from "@/application/ports/PatrimonyRecordRepository";
import {
  PatrimonyRecordService,
  type PatrimonyRecordView,
} from "@/application/use-cases/PatrimonyRecordService";
import type { PatrimonyCategory } from "@/domain/patrimonyCategory";

type PatrimonyBulkImportProps = {
  categories: PatrimonyCategory[];
  service: PatrimonyRecordService;
  onImported(records: PatrimonyRecordView[]): void;
};

type ExcelCell = string | number | boolean | Date | null;
type ExcelRow = ExcelCell[];

type HeaderMap = {
  date?: number;
  category?: number;
  amountCrc?: number;
  amountUsd?: number;
  notes?: number;
};

export function PatrimonyBulkImport({
  categories,
  service,
  onImported,
}: PatrimonyBulkImportProps) {
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState(
    "Formato esperado: Fecha, Categoria, Monto CRC, Monto USD, Nota. Monto USD y nota son opcionales.",
  );

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setImporting(true);
    setMessage("Procesando archivo...");

    try {
      const rows = await readSheet(file) as ExcelRow[];
      const parsedRecords = parseRows(rows, categories);
      const createdRecords = await service.createRecords(parsedRecords);
      onImported(createdRecords);
      setMessage(`Carga masiva completada: ${createdRecords.length} registros importados.`);
    } catch (error) {
      setMessage(`No se pudo importar el archivo: ${getErrorMessage(error)}`);
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  return (
    <section className="card elevated-card import-card">
      <div>
        <p className="eyebrow">Carga masiva</p>
        <h2>Importar desde Excel</h2>
        <p className="muted">
          Usá una hoja con encabezados <strong>Fecha</strong>, <strong>Categoria</strong>, <strong>Monto CRC</strong>, <strong>Monto USD</strong> y <strong>Nota</strong>. La categoría debe existir en el catálogo.
        </p>
      </div>

      <div className="import-format-grid">
        <div>
          <strong>Fecha</strong>
          <span>Formato recomendado: YYYY-MM-DD. Ejemplo: 2026-01-31.</span>
        </div>
        <div>
          <strong>Categoria</strong>
          <span>Texto exacto de una categoría existente. Ejemplo: Inversion Bolsa.</span>
        </div>
        <div>
          <strong>Monto CRC</strong>
          <span>Número positivo en colones sin símbolo de moneda. Ejemplo: 100000.</span>
        </div>
        <div>
          <strong>Monto USD</strong>
          <span>Opcional. Número positivo en dólares sin símbolo. Ejemplo: 200.</span>
        </div>
        <div>
          <strong>Nota</strong>
          <span>Opcional. Texto libre para describir el registro.</span>
        </div>
      </div>

      <a className="template-link" href="/templates/patrimony-records-template.xlsx" download>
        Descargar plantilla vacía
      </a>

      <label className="file-upload">
        Seleccionar archivo Excel
        <input
          accept=".xlsx,.xls"
          disabled={importing}
          onChange={handleFileChange}
          type="file"
        />
      </label>
      <p className="message">{message}</p>
    </section>
  );
}

function parseRows(rows: ExcelRow[], categories: PatrimonyCategory[]): PatrimonyRecordInput[] {
  if (rows.length < 2) {
    throw new Error("El archivo debe tener encabezados y al menos una fila de datos.");
  }

  const [headerRow, ...dataRows] = rows;
  const headerMap = mapHeaders(headerRow);

  if (headerMap.date === undefined || headerMap.category === undefined || headerMap.amountCrc === undefined) {
    throw new Error("Faltan columnas requeridas: Fecha, Categoria y Monto CRC.");
  }

  const categoriesByName = new Map(
    categories.map((category) => [normalizeText(category.name), category]),
  );
  const parsedRows: PatrimonyRecordInput[] = [];

  dataRows.forEach((row, index) => {
    if (row.every((cell) => cell === null || cell === "")) {
      return;
    }

    const rowNumber = index + 2;
    const categoryName = String(row[headerMap.category!] ?? "");
    const category = categoriesByName.get(normalizeText(categoryName));

    if (!category) {
      throw new Error(`Fila ${rowNumber}: categoría no encontrada: ${categoryName}`);
    }

    const amountCrc = parseAmount(row[headerMap.amountCrc!]);
    const amountUsd = headerMap.amountUsd === undefined
      ? null
      : parseOptionalAmount(row[headerMap.amountUsd]);

    if (!Number.isFinite(amountCrc) || amountCrc < 0) {
      throw new Error(`Fila ${rowNumber}: monto CRC inválido.`);
    }

    if (amountUsd !== null && (!Number.isFinite(amountUsd) || amountUsd < 0)) {
      throw new Error(`Fila ${rowNumber}: monto USD inválido.`);
    }

    parsedRows.push({
      recordDate: parseDate(row[headerMap.date!], rowNumber),
      categoryId: category.id,
      amountCrc,
      amountUsd,
      notes: headerMap.notes === undefined ? undefined : String(row[headerMap.notes] ?? "") || undefined,
    });
  });

  if (parsedRows.length === 0) {
    throw new Error("No se encontraron filas válidas para importar.");
  }

  return parsedRows;
}

function mapHeaders(headerRow: ExcelRow): HeaderMap {
  const headerMap: HeaderMap = {};

  headerRow.forEach((cell, index) => {
    const header = normalizeText(String(cell ?? ""));

    if (["fecha", "date"].includes(header)) {
      headerMap.date = index;
    }

    if (["categoria", "category"].includes(header)) {
      headerMap.category = index;
    }

    if (["monto crc", "monto_crc", "amount crc", "amount_crc", "monto", "amount", "valor", "balance"].includes(header)) {
      headerMap.amountCrc = index;
    }

    if (["monto usd", "monto_usd", "amount usd", "amount_usd", "usd"].includes(header)) {
      headerMap.amountUsd = index;
    }

    if (["nota", "notas", "note", "notes"].includes(header)) {
      headerMap.notes = index;
    }
  });

  return headerMap;
}

function parseDate(value: ExcelCell, rowNumber: number) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    return excelSerialDateToIso(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  throw new Error(`Fila ${rowNumber}: fecha inválida.`);
}

function parseAmount(value: ExcelCell) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value.replace(/[^0-9.,-]/g, "").replace(",", "."));
  }

  return Number.NaN;
}

function parseOptionalAmount(value: ExcelCell) {
  if (value === null || value === "") {
    return null;
  }

  return parseAmount(value);
}

function excelSerialDateToIso(serial: number) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000).toISOString().slice(0, 10);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
