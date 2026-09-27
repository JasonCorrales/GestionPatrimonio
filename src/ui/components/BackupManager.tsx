"use client";

import { useState } from "react";
import { getCurrentSession } from "@/data/supabase/auth";

export function BackupManager() {
  const [status, setStatus] = useState("Generá un archivo JSON con tus datos actuales para guardarlo donde prefirás.");
  const [isExporting, setIsExporting] = useState(false);

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

      <div className="form-actions">
        <button disabled={isExporting} onClick={() => void handleExportBackup()} type="button">
          {isExporting ? "Generando backup..." : "Descargar backup JSON"}
        </button>
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido.";
}
