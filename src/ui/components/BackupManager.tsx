"use client";

import { type ChangeEvent, useState } from "react";
import { getCurrentSession } from "@/data/supabase/auth";

const RESTORE_CONFIRMATION_PHRASE = "RESTORE BACKUP";

export function BackupManager() {
  const [status, setStatus] = useState("Generá un archivo JSON con tus datos actuales para guardarlo donde prefirás.");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [confirmationPhrase, setConfirmationPhrase] = useState("");

  const canImport = Boolean(selectedImportFile) && confirmationPhrase === RESTORE_CONFIRMATION_PHRASE && !isImporting;

  async function handleExportBackup() {
    setIsExporting(true);
    setStatus("Preparando el backup...");

    try {
      const session = await getCurrentSession();

      if (!session?.access_token) {
        throw new Error("No hay una sesión activa para generar el backup.");
      }

      const response = await fetch("/api/backups/export", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const backupBlob = await response.blob();
      const filename = getFilenameFromDisposition(response.headers.get("content-disposition"))
        ?? buildFallbackFilename();

      downloadBlob(backupBlob, filename);
      setStatus(`Backup descargado: ${filename}`);
    } catch (error) {
      setStatus(`No se pudo generar el backup: ${getErrorMessage(error)}`);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImportBackup() {
    if (!selectedImportFile) {
      setStatus("Seleccioná un archivo JSON de backup antes de importar.");
      return;
    }

    if (confirmationPhrase !== RESTORE_CONFIRMATION_PHRASE) {
      setStatus(`Para reemplazar tus datos actuales, escribí ${RESTORE_CONFIRMATION_PHRASE}.`);
      return;
    }

    setIsImporting(true);
    setStatus("Validando e importando el backup. Esto reemplaza tus datos actuales...");

    try {
      const session = await getCurrentSession();

      if (!session?.access_token) {
        throw new Error("No hay una sesión activa para importar el backup.");
      }

      const payload = await readJsonFile(selectedImportFile);
      const response = await fetch("/api/backups/import", {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const summary = await response.json() as ImportSummary;
      setStatus(
        `Backup importado. Se restauraron ${summary.categories} categorías, ${summary.patrimonyRecords} registros y ${summary.retirementCalculations} cálculos de jubilación.`,
      );
      setConfirmationPhrase("");
    } catch (error) {
      setStatus(`No se pudo importar el backup: ${getErrorMessage(error)}`);
    } finally {
      setIsImporting(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setSelectedImportFile(file);
    setStatus(
      file
        ? `Backup seleccionado: ${file.name}. Escribí ${RESTORE_CONFIRMATION_PHRASE} para habilitar la restauración destructiva.`
        : "Seleccioná un archivo JSON de backup para restaurar.",
    );
  }

  return (
    <section className="card form backup-card" aria-labelledby="backup-title">
      <p className="eyebrow">Respaldo de datos</p>
      <h1 id="backup-title">Backups</h1>
      <p className="muted">
        Exporta tus categorías, registros patrimoniales y cálculos de jubilación visibles para tu usuario.
        No incluye credenciales ni datos de otros usuarios.
      </p>

      <div className="backup-summary" aria-label="Contenido del backup">
        <article>
          <strong>Categorías</strong>
          <span>Nombre, código, orden y tasa esperada.</span>
        </article>
        <article>
          <strong>Registros</strong>
          <span>Fechas, montos CRC/USD, tipo de movimiento y notas.</span>
        </article>
        <article>
          <strong>Jubilación</strong>
          <span>Escenarios guardados del cálculo de interés compuesto.</span>
        </article>
      </div>

      <div className="backup-actions">
        <section className="backup-panel" aria-labelledby="backup-export-title">
          <h2 id="backup-export-title">Descargar backup</h2>
          <p className="muted">Genera un JSON con los datos visibles para tu sesión actual.</p>
          <div className="form-actions">
            <button disabled={isExporting || isImporting} onClick={() => void handleExportBackup()} type="button">
              {isExporting ? "Generando backup..." : "Descargar backup JSON"}
            </button>
          </div>
        </section>

        <section className="backup-panel backup-danger-zone" aria-labelledby="backup-import-title">
          <h2 id="backup-import-title">Restaurar backup</h2>
          <p>
            Esto reemplaza tus datos actuales: primero elimina tus registros, cálculos y categorías visibles,
            y después inserta el contenido del archivo seleccionado.
          </p>
          <label>
            Archivo JSON
            <input accept="application/json,.json" disabled={isImporting} onChange={handleFileChange} type="file" />
          </label>
          <label>
            Escribí <strong>{RESTORE_CONFIRMATION_PHRASE}</strong> para confirmar
            <input
              autoComplete="off"
              disabled={isImporting}
              onChange={(event) => setConfirmationPhrase(event.target.value)}
              placeholder={RESTORE_CONFIRMATION_PHRASE}
              type="text"
              value={confirmationPhrase}
            />
          </label>
          <div className="form-actions">
            <button
              className="danger-button"
              disabled={!canImport}
              onClick={() => void handleImportBackup()}
              type="button"
            >
              {isImporting ? "Restaurando backup..." : "Reemplazar datos con este backup"}
            </button>
          </div>
        </section>
      </div>

      <p className="message" role="status">{status}</p>
    </section>
  );
}

async function readErrorMessage(response: Response) {
  try {
    const payload: unknown = await response.json();

    if (isRecord(payload) && typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    // Fall back to the HTTP status below.
  }

  return `Error HTTP ${response.status}`;
}

function getFilenameFromDisposition(contentDisposition: string | null) {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);

  return match?.[1];
}

function buildFallbackFilename() {
  return `gestion-patrimonio-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function readJsonFile(file: File) {
  return new Promise<unknown>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch {
        reject(new Error("El archivo seleccionado no contiene JSON válido."));
      }
    });
    reader.addEventListener("error", () => reject(new Error("No se pudo leer el archivo seleccionado.")));
    reader.readAsText(file);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido.";
}

type ImportSummary = {
  categories: number;
  patrimonyRecords: number;
  retirementCalculations: number;
};
