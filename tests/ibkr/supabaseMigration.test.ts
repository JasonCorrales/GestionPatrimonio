import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/012_create_ibkr_portfolio.sql", "utf8");

test("IBKR migration stores owner-scoped snapshots and positions without secrets or raw XML", () => {
  assert.match(sql, /create table if not exists public\.ibkr_portfolio_snapshots/i);
  assert.match(sql, /create table if not exists public\.ibkr_portfolio_positions/i);
  assert.match(sql, /create table if not exists public\.ibkr_sync_jobs/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /for select\s+using \(user_id = auth\.uid\(\)\)/i);
  assert.doesNotMatch(sql, /flex_token|query_token|raw_xml|jascoba|@/i);
});

test("IBKR migration exposes service-role-only atomic replace and bounded sync job contract", () => {
  assert.match(sql, /create or replace function public\.replace_ibkr_portfolio_snapshot/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /auth\.role\(\) <> 'service_role'/i);
  assert.match(sql, /p_report_date < latest_report_date/i);
  assert.match(sql, /delete from public\.ibkr_portfolio_positions/i);
  assert.match(sql, /unique \(snapshot_id, account_id, conid, currency\)/i);
  assert.match(sql, /create unique index .*ibkr_sync_jobs_one_outstanding/i);
  assert.match(sql, /cooldown/i);
  assert.match(sql, /revoke all on function public\.replace_ibkr_portfolio_snapshot/i);
});

test("IBKR migration enforces sync job cooldown, lifecycle and atomic polling RPCs", () => {
  assert.match(sql, /create or replace function public\.create_ibkr_sync_job\s*\(/i);
  assert.match(sql, /pg_advisory_xact_lock\(hashtext\('ibkr_sync_job:' \|\| p_user_id::text\)\)/i);
  assert.match(sql, /cooldown_until > now\(\)/i);
  assert.match(sql, /state in \('requested', 'pending'\)[\s\S]*created_at < now\(\) - interval '30 minutes'/i);
  assert.match(sql, /create or replace function public\.claim_ibkr_sync_poll\s*\(/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /attempts = job\.attempts \+ 1/i);
  assert.match(sql, /public\.ibkr_sync_jobs\.attempts < 12/i);
  assert.doesNotMatch(sql, /\n\s+and attempts < 12/i);
  assert.match(sql, /create or replace function public\.transition_ibkr_sync_job\s*\(/i);
  assert.match(sql, /enforce_ibkr_sync_job_immutability/i);
  assert.match(sql, /old\.user_id <> new\.user_id or old\.id <> new\.id/i);
  assert.match(sql, /new\.attempts < old\.attempts/i);
  assert.match(sql, /new\.cooldown_until < old\.cooldown_until/i);
  assert.match(sql, /revoke all on function public\.create_ibkr_sync_job/i);
  assert.match(sql, /revoke all on function public\.claim_ibkr_sync_poll/i);
  assert.match(sql, /revoke all on function public\.transition_ibkr_sync_job/i);
});
