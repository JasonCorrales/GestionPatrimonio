import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PatrimonyRecordInput,
  PatrimonyRecordRepository,
} from "@/application/ports/PatrimonyRecordRepository";
import type { MonthlyPatrimonyRecord } from "@/domain/monthlyPatrimonyRecord";
import type { PatrimonyCategory } from "@/domain/patrimonyCategory";

const RECORDS_TABLE_NAME = "monthly_patrimony_records";
const CATEGORY_TABLE_NAME = "categoria";

type CategoryRow = {
  id: string;
  code: string;
  name: string;
};

type PatrimonyRecordRow = {
  id: string;
  month: string;
  record_date: string;
  category_id: string;
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  categoria: CategoryRow | CategoryRow[] | null;
};

export class SupabasePatrimonyRecordRepository
  implements PatrimonyRecordRepository
{
  constructor(private readonly supabase: SupabaseClient) {}

  async listCategories(): Promise<PatrimonyCategory[]> {
    const { data, error } = await this.supabase
      .from(CATEGORY_TABLE_NAME)
      .select("id, code, name")
      .order("display_order", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map(fromCategoryRow);
  }

  async list(): Promise<MonthlyPatrimonyRecord[]> {
    const { data, error } = await this.supabase
      .from(RECORDS_TABLE_NAME)
      .select("id, month, record_date, category_id, amount, notes, created_at, updated_at, categoria(id, code, name)")
      .not("category_id", "is", null)
      .order("record_date", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map(fromRecordRow);
  }

  async save(input: PatrimonyRecordInput): Promise<MonthlyPatrimonyRecord> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from(RECORDS_TABLE_NAME)
      .insert(toInsertRow(input, now))
      .select("id, month, record_date, category_id, amount, notes, created_at, updated_at, categoria(id, code, name)")
      .single();

    if (error) {
      throw error;
    }

    return fromRecordRow(data);
  }

  async update(
    id: string,
    input: PatrimonyRecordInput,
  ): Promise<MonthlyPatrimonyRecord> {
    const { data, error } = await this.supabase
      .from(RECORDS_TABLE_NAME)
      .update(toUpdateRow(input))
      .eq("id", id)
      .select("id, month, record_date, category_id, amount, notes, created_at, updated_at, categoria(id, code, name)")
      .single();

    if (error) {
      throw error;
    }

    return fromRecordRow(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(RECORDS_TABLE_NAME)
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }
  }
}

function fromRecordRow(row: PatrimonyRecordRow): MonthlyPatrimonyRecord {
  const category = Array.isArray(row.categoria) ? row.categoria[0] : row.categoria;

  if (!category) {
    throw new Error(`Patrimony record ${row.id} has no category.`);
  }

  return {
    id: row.id,
    recordDate: row.record_date,
    category: fromCategoryRow(category),
    amount: Number(row.amount),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromCategoryRow(row: CategoryRow): PatrimonyCategory {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
  };
}

function toInsertRow(input: PatrimonyRecordInput, now: string) {
  return {
    month: input.recordDate.slice(0, 7),
    record_date: input.recordDate,
    category_id: input.categoryId,
    amount: input.amount,
    notes: input.notes ?? null,
    created_at: now,
    updated_at: now,
  };
}

function toUpdateRow(input: PatrimonyRecordInput) {
  return {
    month: input.recordDate.slice(0, 7),
    record_date: input.recordDate,
    category_id: input.categoryId,
    amount: input.amount,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  };
}
