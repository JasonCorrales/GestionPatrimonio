import type { IbkrPortfolioSnapshot } from "../../domain/ibkrPortfolio";
// @ts-expect-error TS5097: native Node TypeScript tests require the .ts suffix for this value import.
import { classifyIbkrContextError, serializeIbkrError, type IbkrErrorCode, type IbkrErrorStage, type SerializedIbkrError } from "../../data/ibkr/errors.ts";

export type IbkrJobState = "requested" | "pending" | "persisted" | "failed" | "expired";

export type IbkrSyncJobRecord = {
  id: string;
  userId: string;
  state: IbkrJobState;
  referenceCode: string | null;
  lastExternalCode: string | null;
  sanitizedMessage: string | null;
  attempts: number;
  nextAttemptAfter: string | null;
  cooldownUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IbkrStoredSnapshot = IbkrPortfolioSnapshot & {
  id?: string;
  syncedAt: string;
};

export type IbkrPortfolioRepository = {
  latestSnapshot(ownerUserId: string): Promise<IbkrStoredSnapshot | null>;
  latestJob(ownerUserId: string): Promise<IbkrSyncJobRecord | null>;
  findJob(ownerUserId: string, jobId: string): Promise<IbkrSyncJobRecord | null>;
  createSyncJob(ownerUserId: string): Promise<string>;
  claimSyncPoll(ownerUserId: string, jobId: string, nextAttemptAt: string): Promise<{ jobId: string; referenceCode: string | null; attempts: number } | null>;
  transitionSyncJob(ownerUserId: string, jobId: string, patch: TransitionPatch): Promise<void>;
  replaceSnapshot(ownerUserId: string, snapshot: IbkrPortfolioSnapshot): Promise<string>;
};

type TransitionPatch = {
  state: IbkrJobState;
  referenceCode?: string | null;
  lastExternalCode?: string | null;
  sanitizedMessage?: string | null;
  nextAttemptAfter?: string | null;
  cooldownUntil?: string | null;
};

type FlexStatementResult =
  | { state: "ready"; xml: string }
  | { state: "pending"; code: "1019"; message: string }
  | { state: "failed"; code: string | null; message: string };

type FlexClientPort = {
  sendRequest(): Promise<{ state: "requested"; referenceCode: string }>;
  getStatement(referenceCode: string): Promise<FlexStatementResult>;
};

type SafeStatus = {
  configured: boolean;
  owner: boolean;
  snapshot: IbkrStoredSnapshot | null;
  sync: null | {
    jobId: string;
    state: IbkrJobState;
    attempts: number;
    nextAttemptAt: string | null;
    cooldownUntil: string | null;
    updatedAt: string;
    message: string | null;
  };
};

type DiagnosticFields = {
  error?: string;
  errorStage?: IbkrErrorStage;
  errorCode?: IbkrErrorCode;
  secondaryErrorStage?: IbkrErrorStage;
  secondaryErrorCode?: IbkrErrorCode;
};

type ServiceResult = {
  status: number;
  body: SafeStatus & DiagnosticFields;
};

const POLL_INTERVAL_MS = 2 * 60 * 1000;
const MAX_AGE_MS = 30 * 60 * 1000;

export class IbkrPortfolioService {
  private readonly deps: {
    ownerUserId: string;
    repository: IbkrPortfolioRepository;
    flexClient: FlexClientPort;
    parseStatement?: (xml: string, options: { ownerUserId: string }) => IbkrPortfolioSnapshot;
  };

  constructor(deps: {
    ownerUserId: string;
    repository: IbkrPortfolioRepository;
    flexClient: FlexClientPort;
    parseStatement?: (xml: string, options: { ownerUserId: string }) => IbkrPortfolioSnapshot;
  }) {
    this.deps = deps;
  }

  async getStatus(): Promise<ServiceResult> {
    try {
      return { status: 200, body: await this.safeStatus() };
    } catch (error) {
      return this.withStatus(502, "No se pudo leer el estado de IBKR.", error);
    }
  }

  async startSync(): Promise<ServiceResult> {
    let jobId: string;
    try {
      jobId = await this.deps.repository.createSyncJob(this.deps.ownerUserId);
    } catch (error) {
      const diagnostic = serializeIbkrError(error);
      const status = diagnostic.code === "cooldown_active" ? 409 : 502;
      const message = status === 409 ? "Hay una sincronización o enfriamiento activo." : "No se pudo crear la sincronización IBKR.";
      return this.withStatus(status, message, error);
    }

    try {
      const request = await this.deps.flexClient.sendRequest();
      await this.deps.repository.transitionSyncJob(this.deps.ownerUserId, jobId, {
        state: "pending",
        referenceCode: request.referenceCode,
        sanitizedMessage: "IBKR report requested; waiting for statement generation.",
        nextAttemptAfter: isoFromNow(POLL_INTERVAL_MS),
      });
      return this.withStatus(202);
    } catch (error) {
      const primary = serializeIbkrError(error).stage ? error : classifyIbkrContextError("broker", error);
      const secondary = await this.markFailed(jobId, primary);
      return this.withStatus(502, "No se pudo iniciar la sincronización IBKR.", primary, secondary);
    }
  }

  async continueSync(jobId: string): Promise<ServiceResult> {
    if (!isUuid(jobId)) {
      return this.withStatus(400, "Identificador de sincronización inválido.");
    }

    let existingJob: IbkrSyncJobRecord | null;
    try {
      existingJob = await this.deps.repository.findJob(this.deps.ownerUserId, jobId);
    } catch (error) {
      return this.withStatus(502, "No se pudo leer la sincronización IBKR.", error);
    }
    if (!existingJob) {
      return this.withStatus(404, "Sincronización no encontrada.");
    }
    if (!["requested", "pending"].includes(existingJob.state)) {
      return this.withStatus(200);
    }

    const nextAttemptAt = isoFromNow(POLL_INTERVAL_MS);
    let claim: { jobId: string; referenceCode: string | null; attempts: number } | null;
    try {
      claim = await this.deps.repository.claimSyncPoll(this.deps.ownerUserId, jobId, nextAttemptAt);
    } catch (error) {
      return this.withStatus(502, "No se pudo reclamar la sincronización IBKR.", error);
    }
    if (!claim) {
      await this.expireAbandonedJob(jobId);
      return this.withStatus(202);
    }

    if (!claim.referenceCode) {
      const primary = classifyIbkrContextError("broker", new Error("IBKR reference is unavailable"));
      const secondary = await this.markFailed(jobId, primary);
      return this.withStatus(502, "No se pudo continuar la sincronización IBKR.", primary, secondary);
    }

    let statement: FlexStatementResult;
    try {
      statement = await this.deps.flexClient.getStatement(claim.referenceCode);
    } catch (error) {
      const primary = classifyIbkrContextError("broker", error);
      const secondary = await this.markFailed(jobId, primary);
      return this.withStatus(502, "No se pudo consultar IBKR.", primary, secondary);
    }

    if (statement.state === "pending") {
      const terminal = claim.attempts >= 12;
      try {
        await this.deps.repository.transitionSyncJob(this.deps.ownerUserId, jobId, {
          state: terminal ? "expired" : "pending",
          lastExternalCode: statement.code,
          sanitizedMessage: terminal ? "IBKR report expired before completion." : "IBKR report is still pending.",
          nextAttemptAfter: terminal ? null : isoFromNow(POLL_INTERVAL_MS),
        });
      } catch (error) {
        return this.withStatus(502, "No se pudo actualizar la sincronización IBKR.", error);
      }
      return this.withStatus(202);
    }

    if (statement.state === "failed") {
      try {
        await this.deps.repository.transitionSyncJob(this.deps.ownerUserId, jobId, {
          state: "failed",
          lastExternalCode: statement.code,
          sanitizedMessage: statement.message,
          nextAttemptAfter: null,
        });
      } catch (error) {
        return this.withStatus(502, "IBKR no pudo entregar el reporte.", error);
      }
      return this.withStatus(502, "IBKR no pudo entregar el reporte.");
    }

    let portfolio: IbkrPortfolioSnapshot;
    try {
      const parsed = this.deps.parseStatement?.(statement.xml, { ownerUserId: this.deps.ownerUserId });
      if (!parsed) throw new Error("IBKR parser is not configured");
      portfolio = parsed;
    } catch (error) {
      const primary = classifyIbkrContextError("parse", error);
      const secondary = await this.markFailed(jobId, primary);
      return this.withStatus(502, "No se pudo interpretar el reporte IBKR.", primary, secondary);
    }

    try {
      await this.deps.repository.replaceSnapshot(this.deps.ownerUserId, portfolio);
      await this.deps.repository.transitionSyncJob(this.deps.ownerUserId, jobId, {
        state: "persisted",
        sanitizedMessage: "IBKR snapshot persisted.",
        nextAttemptAfter: null,
      });
      return this.withStatus(200);
    } catch (error) {
      const primary = serializeIbkrError(error).stage ? error : classifyIbkrContextError("persist", error);
      const secondary = await this.markFailed(jobId, primary);
      return this.withStatus(502, "No se pudo guardar el reporte IBKR.", primary, secondary);
    }
  }

  private async withStatus(status: number, error?: string, primaryError?: unknown, secondaryError?: unknown): Promise<ServiceResult> {
    const diagnostic = primaryError ? serializeIbkrError(primaryError) : null;
    const secondaryDiagnostic = secondaryError ? serializeIbkrError(secondaryError) : null;
    try {
      const body = await this.safeStatus();
      return { status, body: { ...body, ...(error ? { error } : {}), ...diagnosticFields(diagnostic), ...secondaryDiagnosticFields(secondaryDiagnostic) } };
    } catch (readError) {
      const fallbackSecondary = secondaryDiagnostic ?? serializeIbkrError(readError);
      return {
        status,
        body: {
          configured: true,
          owner: true,
          snapshot: null,
          sync: null,
          ...(error ? { error } : {}),
          ...diagnosticFields(diagnostic),
          ...secondaryDiagnosticFields(fallbackSecondary),
        },
      };
    }
  }

  private async safeStatus() {
    const [snapshot, job] = await Promise.all([
      this.deps.repository.latestSnapshot(this.deps.ownerUserId),
      this.deps.repository.latestJob(this.deps.ownerUserId),
    ]);
    return {
      configured: true,
      owner: true,
      snapshot,
      sync: job ? {
        jobId: job.id,
        state: job.state,
        attempts: job.attempts,
        nextAttemptAt: job.nextAttemptAfter,
        cooldownUntil: job.cooldownUntil,
        updatedAt: job.updatedAt,
        message: job.sanitizedMessage,
      } : null,
    };
  }

  private async markFailed(jobId: string, error: unknown): Promise<unknown | null> {
    try {
      await this.deps.repository.transitionSyncJob(this.deps.ownerUserId, jobId, {
        state: "failed",
        sanitizedMessage: sanitizeError(error),
        nextAttemptAfter: null,
      });
      return null;
    } catch (transitionError) {
      return transitionError;
    }
  }

  private async expireAbandonedJob(jobId: string) {
    const job = await this.deps.repository.findJob(this.deps.ownerUserId, jobId);
    if (!job || job.state !== "pending") return;
    if (Date.now() - new Date(job.createdAt).getTime() <= MAX_AGE_MS) return;
    await this.deps.repository.transitionSyncJob(this.deps.ownerUserId, jobId, {
      state: "expired",
      sanitizedMessage: "IBKR sync expired before completion.",
      nextAttemptAfter: null,
    }).catch(() => undefined);
  }
}

function isoFromNow(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function diagnosticFields(diagnostic: SerializedIbkrError | null): Pick<DiagnosticFields, "errorStage" | "errorCode"> {
  if (!diagnostic) return {};
  return {
    ...(diagnostic.stage ? { errorStage: diagnostic.stage } : {}),
    errorCode: diagnostic.code,
  };
}

function secondaryDiagnosticFields(diagnostic: SerializedIbkrError | null): Pick<DiagnosticFields, "secondaryErrorStage" | "secondaryErrorCode"> {
  if (!diagnostic) return {};
  return {
    ...(diagnostic.stage ? { secondaryErrorStage: diagnostic.stage } : {}),
    secondaryErrorCode: diagnostic.code,
  };
}

function sanitizeError(error: unknown) {
  const diagnostic = serializeIbkrError(error);
  return diagnostic.stage ? `IBKR ${diagnostic.stage} failed (${diagnostic.code}).` : "IBKR sync failed.";
}
