export type IbkrErrorStage = "read" | "create" | "find" | "claim" | "transition" | "persist" | "broker" | "parse";
export type IbkrErrorCode = "unknown" | "cooldown_active" | "PGRST202" | "42501" | "42P01" | "42702" | "22007" | "22P02";

const ALLOWED_CODES = new Set<IbkrErrorCode>(["cooldown_active", "PGRST202", "42501", "42P01", "42702", "22007", "22P02"]);
const ALLOWED_STAGES = new Set<IbkrErrorStage>(["read", "create", "find", "claim", "transition", "persist", "broker", "parse"]);
const COOLDOWN_MESSAGES = new Set([
  "IBKR sync cooldown is still active",
  "IBKR sync already in progress",
]);

export type SerializedIbkrError = {
  stage?: IbkrErrorStage;
  code: IbkrErrorCode;
};

export class IbkrStageError extends Error {
  readonly stage: IbkrErrorStage;
  readonly code: IbkrErrorCode;

  constructor(stage: IbkrErrorStage, options?: { code?: string | null; cause?: unknown }) {
    super("IBKR operation failed", { cause: options?.cause });
    this.name = "IbkrStageError";
    this.stage = stage;
    this.code = normalizeIbkrCode(options?.code);
  }
}

export function serializeIbkrError(error: unknown): SerializedIbkrError {
  if (error instanceof IbkrStageError) {
    return { stage: error.stage, code: error.code };
  }
  return { code: "unknown" };
}

export function classifyIbkrDbError(stage: IbkrErrorStage, error: unknown): IbkrStageError {
  return new IbkrStageError(stage, { code: extractAllowedCode(error), cause: error });
}

export function classifyIbkrContextError(stage: IbkrErrorStage, error: unknown): IbkrStageError {
  return new IbkrStageError(stage, { code: "unknown", cause: error });
}

export function normalizeIbkrCode(code: string | null | undefined): IbkrErrorCode {
  return code && ALLOWED_CODES.has(code as IbkrErrorCode) ? code as IbkrErrorCode : "unknown";
}

export function isIbkrStage(value: unknown): value is IbkrErrorStage {
  return typeof value === "string" && ALLOWED_STAGES.has(value as IbkrErrorStage);
}

function extractAllowedCode(error: unknown): IbkrErrorCode {
  const candidate = error && typeof error === "object" ? error as { code?: unknown; message?: unknown } : null;
  if (typeof candidate?.message === "string" && COOLDOWN_MESSAGES.has(candidate.message)) {
    return "cooldown_active";
  }
  if (typeof candidate?.code === "string") {
    return normalizeIbkrCode(candidate.code);
  }
  return "unknown";
}
