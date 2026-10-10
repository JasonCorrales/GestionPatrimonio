export type IbkrPollingSyncState = {
  jobId: string;
  state: string;
  nextAttemptAt: string | null;
};

export type IbkrPollingDecision =
  | { action: "stop"; canResume: boolean }
  | { action: "poll"; delayMs: number; failedAttempts: number; canResume: false };

const MAX_TRANSIENT_FAILURES = 3;
const BASE_BACKOFF_MS = 10_000;
const MAX_BACKOFF_MS = 60_000;

export function planIbkrPoll(input: {
  sync: IbkrPollingSyncState | null | undefined;
  nowMs: number;
  failedAttempts: number;
}): IbkrPollingDecision {
  if (!input.sync || !["requested", "pending"].includes(input.sync.state) || !input.sync.nextAttemptAt) {
    return { action: "stop", canResume: false };
  }

  if (input.failedAttempts >= MAX_TRANSIENT_FAILURES) {
    return { action: "stop", canResume: true };
  }

  const nextAttemptMs = Date.parse(input.sync.nextAttemptAt);
  const dbDelay = Number.isFinite(nextAttemptMs) ? Math.max(0, nextAttemptMs - input.nowMs) : BASE_BACKOFF_MS;
  const backoff = input.failedAttempts === 0
    ? 0
    : Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (input.failedAttempts - 1));

  return {
    action: "poll",
    delayMs: Math.max(dbDelay, backoff),
    failedAttempts: input.failedAttempts,
    canResume: false,
  };
}
