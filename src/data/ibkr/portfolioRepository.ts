import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { IbkrPortfolioSnapshot } from "../../domain/ibkrPortfolio";
import type { IbkrPortfolioRepository, IbkrStoredSnapshot, IbkrSyncJobRecord } from "../../application/use-cases/IbkrPortfolioService";
import { classifyIbkrDbError } from "./errors";

type DbSnapshotRow = {
  id: string;
  user_id: string;
  account_id: string;
  report_date: string;
  generated_at: string | null;
  nav_amount: string | null;
  nav_currency: string | null;
  cash_amount: string | null;
  cash_currency: string | null;
  synced_at: string;
};

type DbPositionRow = {
  account_id: string;
  conid: string;
  symbol: string | null;
  currency: string;
  quantity: string | null;
  multiplier: string | null;
  mark_price: string | null;
  position_value: string | null;
  cost_basis_money: string | null;
  cost_basis_price: string | null;
  fifo_pnl_unrealized: string | null;
};

type DbJobRow = {
  id: string;
  user_id: string;
  state: IbkrSyncJobRecord["state"];
  reference_code: string | null;
  last_external_code: string | null;
  sanitized_message: string | null;
  attempts: number;
  next_attempt_after: string | null;
  cooldown_until: string | null;
  created_at: string;
  updated_at: string;
};

export function createIbkrPortfolioRepository(config: {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}): IbkrPortfolioRepository {
  return new SupabaseIbkrPortfolioRepository(createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }));
}

class SupabaseIbkrPortfolioRepository implements IbkrPortfolioRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async latestSnapshot(ownerUserId: string): Promise<IbkrStoredSnapshot | null> {
    const { data: snapshot, error } = await this.supabase
      .from("ibkr_portfolio_snapshots")
      .select("id, user_id, account_id, report_date, generated_at, nav_amount, nav_currency, cash_amount, cash_currency, synced_at")
      .eq("user_id", ownerUserId)
      .order("report_date", { ascending: false })
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw classifyIbkrDbError("read", error);
    if (!snapshot) return null;

    const { data: positions, error: positionsError } = await this.supabase
      .from("ibkr_portfolio_positions")
      .select("account_id, conid, symbol, currency, quantity, multiplier, mark_price, position_value, cost_basis_money, cost_basis_price, fifo_pnl_unrealized")
      .eq("snapshot_id", (snapshot as DbSnapshotRow).id)
      .order("symbol", { ascending: true, nullsFirst: false });

    if (positionsError) throw classifyIbkrDbError("read", positionsError);
    return mapSnapshot(snapshot as DbSnapshotRow, (positions ?? []) as DbPositionRow[]);
  }

  async latestJob(ownerUserId: string): Promise<IbkrSyncJobRecord | null> {
    const { data, error } = await this.supabase
      .from("ibkr_sync_jobs")
      .select("id, user_id, state, reference_code, last_external_code, sanitized_message, attempts, next_attempt_after, cooldown_until, created_at, updated_at")
      .eq("user_id", ownerUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw classifyIbkrDbError("read", error);
    return data ? mapJob(data as DbJobRow) : null;
  }

  async findJob(ownerUserId: string, jobId: string): Promise<IbkrSyncJobRecord | null> {
    const { data, error } = await this.supabase
      .from("ibkr_sync_jobs")
      .select("id, user_id, state, reference_code, last_external_code, sanitized_message, attempts, next_attempt_after, cooldown_until, created_at, updated_at")
      .eq("user_id", ownerUserId)
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw classifyIbkrDbError("find", error);
    return data ? mapJob(data as DbJobRow) : null;
  }

  async createSyncJob(ownerUserId: string): Promise<string> {
    const { data, error } = await this.supabase.rpc("create_ibkr_sync_job", { p_user_id: ownerUserId });
    if (error) throw classifyIbkrDbError("create", error);
    if (typeof data !== "string") throw classifyIbkrDbError("create", null);
    return data;
  }

  async claimSyncPoll(ownerUserId: string, jobId: string, nextAttemptAt: string) {
    const { data, error } = await this.supabase.rpc("claim_ibkr_sync_poll", {
      p_user_id: ownerUserId,
      p_job_id: jobId,
      p_next_attempt_after: nextAttemptAt,
    });
    if (error) throw classifyIbkrDbError("claim", error);
    const row = Array.isArray(data) ? data[0] : null;
    return row ? { jobId: row.job_id as string, referenceCode: row.reference_code as string | null, attempts: row.attempts as number } : null;
  }

  async transitionSyncJob(ownerUserId: string, jobId: string, patch: Parameters<IbkrPortfolioRepository["transitionSyncJob"]>[2]) {
    const { error } = await this.supabase.rpc("transition_ibkr_sync_job", {
      p_user_id: ownerUserId,
      p_job_id: jobId,
      p_state: patch.state,
      p_reference_code: patch.referenceCode ?? null,
      p_last_external_code: patch.lastExternalCode ?? null,
      p_sanitized_message: patch.sanitizedMessage ?? null,
      p_next_attempt_after: patch.nextAttemptAfter ?? null,
      p_cooldown_until: patch.cooldownUntil ?? null,
    });
    if (error) throw classifyIbkrDbError("transition", error);
  }

  async replaceSnapshot(ownerUserId: string, snapshot: IbkrPortfolioSnapshot): Promise<string> {
    const { data, error } = await this.supabase.rpc("replace_ibkr_portfolio_snapshot", {
      p_user_id: ownerUserId,
      p_account_id: snapshot.accountId,
      p_report_date: snapshot.reportDate,
      p_generated_at: snapshot.generatedAt,
      p_nav_amount: snapshot.nav?.amount ?? null,
      p_nav_currency: snapshot.nav?.currency ?? null,
      p_cash_amount: snapshot.cash?.amount ?? null,
      p_cash_currency: snapshot.cash?.currency ?? null,
      p_positions: snapshot.positions,
    });
    if (error) throw classifyIbkrDbError("persist", error);
    if (typeof data !== "string") throw classifyIbkrDbError("persist", null);
    return data;
  }
}

function mapSnapshot(row: DbSnapshotRow, positions: DbPositionRow[]): IbkrStoredSnapshot {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    reportDate: row.report_date,
    generatedAt: row.generated_at,
    syncedAt: row.synced_at,
    nav: row.nav_amount && row.nav_currency ? { amount: row.nav_amount, currency: row.nav_currency } : null,
    cash: row.cash_amount && row.cash_currency ? { amount: row.cash_amount, currency: row.cash_currency } : null,
    positions: positions.map((position) => ({
      accountId: position.account_id,
      conid: position.conid,
      symbol: position.symbol,
      currency: position.currency,
      quantity: position.quantity,
      multiplier: position.multiplier,
      markPrice: position.mark_price,
      positionValue: position.position_value,
      costBasisMoney: position.cost_basis_money,
      costBasisPrice: position.cost_basis_price,
      fifoPnlUnrealized: position.fifo_pnl_unrealized,
    })),
  };
}

function mapJob(row: DbJobRow): IbkrSyncJobRecord {
  return {
    id: row.id,
    userId: row.user_id,
    state: row.state,
    referenceCode: row.reference_code,
    lastExternalCode: row.last_external_code,
    sanitizedMessage: row.sanitized_message,
    attempts: row.attempts,
    nextAttemptAfter: row.next_attempt_after,
    cooldownUntil: row.cooldown_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
