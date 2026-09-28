import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RetirementCalculationRepository,
  SaveRetirementCalculationInput,
} from "@/application/ports/RetirementCalculationRepository";
import type { SavedRetirementCalculation } from "@/domain/retirementCalculation";

const TABLE_NAME = "retirement_calculations";

type RetirementCalculationRow = {
  id: string;
  description: string;
  is_active: boolean;
  initial_balance: number;
  periodic_amount: number;
  annual_interest_rate: number;
  duration_years: number;
  final_amount: number;
  total_contributed: number;
  estimated_interest: number;
  estimated_monthly_amount: number;
  created_at: string;
};

export class SupabaseRetirementCalculationRepository
  implements RetirementCalculationRepository
{
  constructor(private readonly supabase: SupabaseClient) {}

  async list(): Promise<SavedRetirementCalculation[]> {
    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map(fromRow);
  }

  async getActive(): Promise<SavedRetirementCalculation | null> {
    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? fromRow(data) : null;
  }

  async save(
    input: SaveRetirementCalculationInput,
  ): Promise<SavedRetirementCalculation> {
    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .insert(toInsertRow(input))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return fromRow(data);
  }

  async setActive(id: string): Promise<SavedRetirementCalculation> {
    const { error: clearError } = await this.supabase
      .from(TABLE_NAME)
      .update({ is_active: false })
      .eq("is_active", true);

    if (clearError) {
      throw clearError;
    }

    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .update({ is_active: true })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return fromRow(data);
  }

  async delete(id: string): Promise<void> {
    const { data: existing, error: existingError } = await this.supabase
      .from(TABLE_NAME)
      .select("is_active")
      .eq("id", id)
      .single();

    if (existingError) {
      throw existingError;
    }

    const { error } = await this.supabase
      .from(TABLE_NAME)
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }

    if (existing?.is_active) {
      const [nextActive] = await this.list();

      if (nextActive) {
        await this.setActive(nextActive.id);
      }
    }
  }
}

function fromRow(row: RetirementCalculationRow): SavedRetirementCalculation {
  return {
    id: row.id,
    description: row.description,
    isActive: row.is_active,
    initialBalance: Number(row.initial_balance),
    periodicAmount: Number(row.periodic_amount),
    annualInterestRate: Number(row.annual_interest_rate),
    durationYears: Number(row.duration_years),
    finalAmount: Number(row.final_amount),
    totalContributed: Number(row.total_contributed),
    estimatedInterest: Number(row.estimated_interest),
    estimatedMonthlyAmount: Number(row.estimated_monthly_amount),
    createdAt: row.created_at,
  };
}

function toInsertRow(input: SaveRetirementCalculationInput) {
  return {
    description: input.description,
    is_active: input.isActive,
    initial_balance: input.initialBalance,
    periodic_amount: input.periodicAmount,
    annual_interest_rate: input.annualInterestRate,
    duration_years: input.durationYears,
    final_amount: input.finalAmount,
    total_contributed: input.totalContributed,
    estimated_interest: input.estimatedInterest,
    estimated_monthly_amount: input.estimatedMonthlyAmount,
  };
}
