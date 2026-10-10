import test from "node:test";
import assert from "node:assert/strict";

// @ts-expect-error TS5097: native Node TypeScript import requires the .ts suffix.
import { planIbkrPoll } from "../../src/ui/ibkrPolling.ts";

test("planIbkrPoll respects DB nextAttempt and bounded transient backoff before resume", () => {
  const now = Date.parse("2024-06-01T12:00:00Z");
  assert.deepEqual(planIbkrPoll({
    nowMs: now,
    failedAttempts: 0,
    sync: { jobId: "job", state: "pending", nextAttemptAt: "2024-06-01T12:02:00Z" },
  }), { action: "poll", delayMs: 120_000, failedAttempts: 0, canResume: false });

  assert.deepEqual(planIbkrPoll({
    nowMs: now,
    failedAttempts: 2,
    sync: { jobId: "job", state: "pending", nextAttemptAt: "2024-06-01T11:59:00Z" },
  }), { action: "poll", delayMs: 20_000, failedAttempts: 2, canResume: false });

  assert.deepEqual(planIbkrPoll({
    nowMs: now,
    failedAttempts: 3,
    sync: { jobId: "job", state: "pending", nextAttemptAt: "2024-06-01T11:59:00Z" },
  }), { action: "stop", canResume: true });
});

test("planIbkrPoll stops when the job is terminal or absent", () => {
  assert.deepEqual(planIbkrPoll({ nowMs: 0, failedAttempts: 0, sync: null }), { action: "stop", canResume: false });
  assert.deepEqual(planIbkrPoll({ nowMs: 0, failedAttempts: 0, sync: { jobId: "job", state: "failed", nextAttemptAt: null } }), { action: "stop", canResume: false });
});
