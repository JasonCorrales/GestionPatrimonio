import test from "node:test";
import assert from "node:assert/strict";

// @ts-expect-error TS5097: native Node TypeScript import requires the .ts suffix.
import { authorizeIbkrOwnerPure, toSafePortfolioStatus } from "../../src/data/ibkr/auth.ts";
// @ts-expect-error TS5097: native Node TypeScript import requires the .ts suffix.
import { IbkrPortfolioService } from "../../src/application/use-cases/IbkrPortfolioService.ts";
// @ts-expect-error TS5097: native Node TypeScript import requires the .ts suffix.
import { classifyIbkrDbError, IbkrStageError, serializeIbkrError } from "../../src/data/ibkr/errors.ts";

const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";
const missingJobId = "44444444-4444-4444-8444-444444444444";
const snapshot = {
  id: "snap-1",
  userId: ownerId,
  accountId: "DU123",
  reportDate: "2024-05-31",
  generatedAt: "2024-06-01T12:00:00",
  nav: { amount: "1000.00", currency: "USD" },
  cash: null,
  syncedAt: "2024-06-01T12:05:00Z",
  positions: [
    {
      accountId: "DU123",
      conid: "265598",
      symbol: "AAPL",
      currency: "USD",
      quantity: "3",
      multiplier: null,
      markPrice: "190.25",
      positionValue: "570.75",
      costBasisMoney: "500.25",
      costBasisPrice: "166.75",
      fifoPnlUnrealized: "70.50",
    },
  ],
};

test("authorizeIbkrOwner validates bearer sessions before owner-only service work", async () => {
  const validConfig = {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon",
    supabaseServiceRoleKey: "service",
    ibkrOwnerUserId: ownerId,
    ibkrFlexToken: "token",
    ibkrFlexQueryId: "query",
  };
  const getUser = async (token: string) => token === "good"
    ? { data: { user: { id: ownerId } }, error: null }
    : { data: { user: null }, error: new Error("bad") };

  assert.equal((await authorizeIbkrOwnerPure({ authorization: null, config: validConfig, getUser })).status, 401);
  assert.equal((await authorizeIbkrOwnerPure({ authorization: "Bearer bad", config: validConfig, getUser })).status, 401);
  assert.equal((await authorizeIbkrOwnerPure({ authorization: "Bearer good", config: { ...validConfig, ibkrOwnerUserId: otherId }, getUser })).status, 403);
  assert.equal((await authorizeIbkrOwnerPure({ authorization: "Bearer good", config: { ...validConfig, ibkrOwnerUserId: "not-a-uuid" }, getUser })).status, 503);
  assert.equal((await authorizeIbkrOwnerPure({ authorization: "Bearer good", config: validConfig, getUser })).status, 200);
});

test("status DTO omits secrets, reference codes and raw account configuration", () => {
  const dto = toSafePortfolioStatus({
    configured: true,
    owner: true,
    snapshot,
    job: {
      id: "job-1",
      userId: ownerId,
      state: "pending",
      referenceCode: "SECRET-REFERENCE",
      lastExternalCode: "1019",
      sanitizedMessage: "pending",
      attempts: 1,
      nextAttemptAfter: "2024-06-01T12:07:00Z",
      cooldownUntil: "2024-06-01T12:20:00Z",
      createdAt: "2024-06-01T12:05:00Z",
      updatedAt: "2024-06-01T12:05:00Z",
    },
  });

  const text = JSON.stringify(dto);
  assert.equal(dto.configured, true);
  assert.equal(dto.snapshot?.accountId, "DU123");
  assert.equal(dto.snapshot?.positions[0].positionValue, "570.75");
  assert.doesNotMatch(text, /SECRET-REFERENCE|query|token|rawXml|referenceCode/i);
});

test("startSync creates one DB-gated job, persists pending reference and returns safe 202", async () => {
  const calls: string[] = [];
  const service = new IbkrPortfolioService({
    ownerUserId: ownerId,
    repository: {
      latestSnapshot: async () => null,
      latestJob: async () => null,
      createSyncJob: async () => { calls.push("create"); return "job-1"; },
      transitionSyncJob: async (_owner, jobId, patch) => { calls.push(`transition:${jobId}:${patch.state}:${patch.referenceCode}`); },
      claimSyncPoll: async () => null,
      replaceSnapshot: async () => "snap-1",
      findJob: async () => null,
    },
    flexClient: {
      sendRequest: async () => { calls.push("send"); return { state: "requested", referenceCode: "REF-1" }; },
      getStatement: async () => ({ state: "pending", code: "1019", message: "pending" }),
    },
  });

  const result = await service.startSync();
  assert.equal(result.status, 202);
  assert.deepEqual(calls, ["create", "send", "transition:job-1:pending:REF-1"]);
  assert.doesNotMatch(JSON.stringify(result.body), /REF-1/);
});

test("continueSync treats an empty claim as waiting instead of success and does not call IBKR", async () => {
  let getStatementCalls = 0;
  const service = new IbkrPortfolioService({
    ownerUserId: ownerId,
    repository: {
      latestSnapshot: async () => snapshot,
      latestJob: async () => ({ id: jobId, userId: ownerId, state: "pending", referenceCode: "REF", lastExternalCode: null, sanitizedMessage: null, attempts: 1, nextAttemptAfter: "2024-06-01T12:07:00Z", cooldownUntil: null, createdAt: "2024-06-01T12:05:00Z", updatedAt: "2024-06-01T12:05:00Z" }),
      createSyncJob: async () => jobId,
      transitionSyncJob: async () => undefined,
      claimSyncPoll: async () => null,
      replaceSnapshot: async () => "snap-1",
      findJob: async () => ({ id: jobId, userId: ownerId, state: "pending", referenceCode: "REF", lastExternalCode: null, sanitizedMessage: null, attempts: 1, nextAttemptAfter: "2024-06-01T12:07:00Z", cooldownUntil: null, createdAt: "2024-06-01T12:05:00Z", updatedAt: "2024-06-01T12:05:00Z" }),
    },
    flexClient: {
      sendRequest: async () => ({ state: "requested", referenceCode: "REF" }),
      getStatement: async () => { getStatementCalls += 1; return { state: "ready", xml: "" }; },
    },
  });

  const result = await service.continueSync(jobId);
  assert.equal(result.status, 202);
  assert.ok(result.body.sync);
  assert.equal(result.body.sync.state, "pending");
  assert.equal(getStatementCalls, 0);
});

test("continueSync rejects malformed or unknown job ids before claim or IBKR calls", async () => {
  const calls: string[] = [];
  const service = new IbkrPortfolioService({
    ownerUserId: ownerId,
    repository: {
      latestSnapshot: async () => snapshot,
      latestJob: async () => null,
      createSyncJob: async () => jobId,
      transitionSyncJob: async () => undefined,
      claimSyncPoll: async () => { calls.push("claim"); return null; },
      replaceSnapshot: async () => "snap-1",
      findJob: async () => null,
    },
    flexClient: {
      sendRequest: async () => ({ state: "requested", referenceCode: "REF" }),
      getStatement: async () => { calls.push("ibkr"); return { state: "ready", xml: "" }; },
    },
  });

  assert.equal((await service.continueSync("not-a-uuid")).status, 400);
  assert.equal((await service.continueSync(missingJobId)).status, 404);
  assert.deepEqual(calls, []);
});

test("safe diagnostic serialization preserves stage and allowlisted codes without raw secrets", () => {
  assert.deepEqual(
    serializeIbkrError(new IbkrStageError("persist", { code: "22007", cause: new Error("token SECRET_TOKEN_1234567890 bad timestamptz") })),
    { stage: "persist", code: "22007" },
  );
  assert.deepEqual(serializeIbkrError(new Error("https://example.invalid?token=SECRET reference REF123456789012")), { code: "unknown" });
  assert.deepEqual(serializeIbkrError(classifyIbkrDbError("create", { code: "PGRST202", message: "schema cache detail SECRET123456789" })), { stage: "create", code: "PGRST202" });
  assert.deepEqual(serializeIbkrError(classifyIbkrDbError("persist", { code: "42501", details: "raw SQL user 11111111-1111-4111-8111-111111111111" })), { stage: "persist", code: "42501" });
  assert.deepEqual(serializeIbkrError(classifyIbkrDbError("persist", { code: "42P01" })), { stage: "persist", code: "42P01" });
  assert.deepEqual(serializeIbkrError(classifyIbkrDbError("claim", { code: "42702", message: "column reference attempts is ambiguous SECRET123456789" })), { stage: "claim", code: "42702" });
  assert.deepEqual(serializeIbkrError(classifyIbkrDbError("persist", { code: "22P02" })), { stage: "persist", code: "22P02" });
});

test("startSync distinguishes safe cooldown conflicts from broken DB create diagnostics", async () => {
  const cooldownService = new IbkrPortfolioService({
    ownerUserId: ownerId,
    repository: {
      latestSnapshot: async () => null,
      latestJob: async () => null,
      createSyncJob: async () => { throw new IbkrStageError("create", { code: "cooldown_active" }); },
      transitionSyncJob: async () => undefined,
      claimSyncPoll: async () => null,
      replaceSnapshot: async () => "snap-1",
      findJob: async () => null,
    },
    flexClient: {
      sendRequest: async () => ({ state: "requested", referenceCode: "REF" }),
      getStatement: async () => ({ state: "pending", code: "1019", message: "pending" }),
    },
  });
  const cooldown = await cooldownService.startSync();
  assert.equal(cooldown.status, 409);
  assert.equal(cooldown.body.errorCode, "cooldown_active");
  assert.equal(cooldown.body.errorStage, "create");

  const brokenDb = new IbkrPortfolioService({
    ownerUserId: ownerId,
    repository: {
      latestSnapshot: async () => null,
      latestJob: async () => null,
      createSyncJob: async () => { throw new IbkrStageError("create", { code: "PGRST202", cause: new Error("missing RPC token SECRET123456789") }); },
      transitionSyncJob: async () => undefined,
      claimSyncPoll: async () => null,
      replaceSnapshot: async () => "snap-1",
      findJob: async () => null,
    },
    flexClient: {
      sendRequest: async () => ({ state: "requested", referenceCode: "REF" }),
      getStatement: async () => ({ state: "pending", code: "1019", message: "pending" }),
    },
  });
  const failed = await brokenDb.startSync();
  assert.equal(failed.status, 502);
  assert.equal(failed.body.errorCode, "PGRST202");
  assert.equal(failed.body.errorStage, "create");
  assert.doesNotMatch(JSON.stringify(failed.body), /SECRET|missing RPC/i);
});

test("withStatus preserves primary operation failure when failure marking and status read also fail", async () => {
  const service = new IbkrPortfolioService({
    ownerUserId: ownerId,
    repository: {
      latestSnapshot: async () => { throw new IbkrStageError("read", { code: "42501", cause: new Error("permission denied SECRET123456789") }); },
      latestJob: async () => null,
      createSyncJob: async () => jobId,
      transitionSyncJob: async () => { throw new IbkrStageError("transition", { code: "42P01", cause: new Error("transition SQL SECRET987654321") }); },
      claimSyncPoll: async () => null,
      replaceSnapshot: async () => "snap-1",
      findJob: async () => null,
    },
    flexClient: {
      sendRequest: async () => { throw new Error("upstream SECRET_TOKEN_123456"); },
      getStatement: async () => ({ state: "pending", code: "1019", message: "pending" }),
    },
  });

  const result = await service.startSync();
  assert.equal(result.status, 502);
  assert.equal(result.body.errorStage, "broker");
  assert.equal(result.body.errorCode, "unknown");
  assert.equal(result.body.secondaryErrorStage, "transition");
  assert.equal(result.body.secondaryErrorCode, "42P01");
  assert.doesNotMatch(JSON.stringify(result.body), /SECRET|permission denied|upstream|transition SQL/i);
});

test("persist failure remains primary when markFailed transition and status read also fail", async () => {
  const service = new IbkrPortfolioService({
    ownerUserId: ownerId,
    repository: {
      latestSnapshot: async () => { throw new IbkrStageError("read", { code: "42501", cause: new Error("read SECRET123456789") }); },
      latestJob: async () => null,
      createSyncJob: async () => jobId,
      transitionSyncJob: async () => { throw new IbkrStageError("transition", { code: "42P01", cause: new Error("transition SECRET123456789") }); },
      claimSyncPoll: async () => ({ jobId, referenceCode: "REF", attempts: 1 }),
      replaceSnapshot: async () => { throw new IbkrStageError("persist", { code: "22007", cause: new Error("bad timestamp SECRET123456789") }); },
      findJob: async () => ({ id: jobId, userId: ownerId, state: "pending", referenceCode: "REF", lastExternalCode: null, sanitizedMessage: null, attempts: 1, nextAttemptAfter: "2024-06-01T12:07:00Z", cooldownUntil: null, createdAt: "2024-06-01T12:05:00Z", updatedAt: "2024-06-01T12:05:00Z" }),
    },
    flexClient: {
      sendRequest: async () => ({ state: "requested", referenceCode: "REF" }),
      getStatement: async () => ({ state: "ready", xml: "<xml />" }),
    },
    parseStatement: () => ({ ...snapshot, syncedAt: undefined as never }),
  });

  const result = await service.continueSync(jobId);
  assert.equal(result.status, 502);
  assert.equal(result.body.errorStage, "persist");
  assert.equal(result.body.errorCode, "22007");
  assert.equal(result.body.secondaryErrorStage, "transition");
  assert.equal(result.body.secondaryErrorCode, "42P01");
  assert.doesNotMatch(JSON.stringify(result.body), /SECRET|bad timestamp|read /i);
});

test("ready statements persist snapshots before marking jobs persisted; failures preserve previous snapshot", async () => {
  const calls: string[] = [];
  const readyService = new IbkrPortfolioService({
    ownerUserId: ownerId,
    repository: {
      latestSnapshot: async () => null,
      latestJob: async () => null,
      createSyncJob: async () => jobId,
      transitionSyncJob: async (_owner, jobId, patch) => { calls.push(`transition:${jobId}:${patch.state}`); },
      claimSyncPoll: async () => ({ jobId, referenceCode: "REF", attempts: 2 }),
      replaceSnapshot: async (_owner, portfolio) => { calls.push(`replace:${portfolio.reportDate}`); return "snap-2"; },
      findJob: async () => ({ id: jobId, userId: ownerId, state: "pending", referenceCode: "REF", lastExternalCode: null, sanitizedMessage: null, attempts: 1, nextAttemptAfter: "2024-06-01T12:07:00Z", cooldownUntil: null, createdAt: "2024-06-01T12:05:00Z", updatedAt: "2024-06-01T12:05:00Z" }),
    },
    flexClient: {
      sendRequest: async () => ({ state: "requested", referenceCode: "REF" }),
      getStatement: async () => ({ state: "ready", xml: `<FlexQueryResponse><FlexStatements><FlexStatement accountId="DU123" toDate="2024-06-30"><OpenPositions /></FlexStatement></FlexStatements></FlexQueryResponse>` }),
    },
    parseStatement: () => ({ ...snapshot, reportDate: "2024-06-30", syncedAt: undefined as never }),
  });
  assert.equal((await readyService.continueSync(jobId)).status, 200);
  assert.deepEqual(calls, ["replace:2024-06-30", `transition:${jobId}:persisted`]);

  let replaced = false;
  const failingService = new IbkrPortfolioService({
    ownerUserId: ownerId,
    repository: {
      latestSnapshot: async () => snapshot,
      latestJob: async () => null,
      createSyncJob: async () => jobId,
      transitionSyncJob: async (_owner, _jobId, patch) => { calls.push(`failure:${patch.state}`); },
      claimSyncPoll: async () => ({ jobId, referenceCode: "REF", attempts: 12 }),
      replaceSnapshot: async () => { replaced = true; return "snap-x"; },
      findJob: async () => ({ id: jobId, userId: ownerId, state: "pending", referenceCode: "REF", lastExternalCode: null, sanitizedMessage: null, attempts: 12, nextAttemptAfter: "2024-06-01T12:07:00Z", cooldownUntil: null, createdAt: "2024-06-01T12:05:00Z", updatedAt: "2024-06-01T12:05:00Z" }),
    },
    flexClient: {
      sendRequest: async () => ({ state: "requested", referenceCode: "REF" }),
      getStatement: async () => ({ state: "failed", code: "500", message: "upstream unavailable" }),
    },
  });
  const failed = await failingService.continueSync(jobId);
  assert.equal(failed.status, 502);
  assert.equal(failed.body.snapshot?.reportDate, "2024-05-31");
  assert.equal(replaced, false);
});
