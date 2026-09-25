import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PatrimonyCategoryInput,
  PatrimonyRecordInput,
  PatrimonyRecordRepository,
} from "@/application/ports/PatrimonyRecordRepository";
import type { MonthlyPatrimonyRecord } from "@/domain/monthlyPatrimonyRecord";
import type { PatrimonyCategory } from "@/domain/patrimonyCategory";

const RECORDS_TABLE_NAME = "monthly_patrimony_records";
const CATEGORY_TABLE_NAME = "category";
const CATEGORY_SELECT = "id, code, name, display_order, interest_rate";
const RECORD_SELECT = `id, month, record_date, category_id, amount_crc, amount_usd, notes, created_at, updated_at, category(${CATEGORY_SELECT})`;

type CategoryRow = {
  id: string;
  code: string;
  name: string;
  display_order: number;
  interest_rate: number | null;
};

type PatrimonyRecordRow = {
  id: string;
  month: string;
  record_date: string;
  category_id: string;
  amount_crc: number;
  amount_usd: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  category: CategoryRow | CategoryRow[] | null;
};

export class SupabasePatrimonyRecordRepository
  implements PatrimonyRecordRepository
{
  constructor(private readonly supabase: SupabaseClient) {}

  async listCategories(): Promise<PatrimonyCategory[]> {
    const { data, error } = await this.supabase
      .from(CATEGORY_TABLE_NAME)
      .select(CATEGORY_SELECT)
      .order("display_order", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map(fromCategoryRow);
  }

  async createCategory(input: PatrimonyCategoryInput): Promise<PatrimonyCategory> {
    const { data, error } = await this.supabase
      .from(CATEGORY_TABLE_NAME)
      .insert({
        code: slugify(input.name),
        name: input.name,
        display_order: await this.nextCategoryDisplayOrder(),
        interest_rate: input.interestRate ?? null,
      })
      .select(CATEGORY_SELECT)
      .single();

    if (error) {
      throw error;
    }

    return fromCategoryRow(data);
  }

  async updateCategory(
    id: string,
    input: PatrimonyCategoryInput,
  ): Promise<PatrimonyCategory> {
    const { data, error } = await this.supabase
      .from(CATEGORY_TABLE_NAME)
      .update({
        code: slugify(input.name),
        name: input.name,
        interest_rate: input.interestRate ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(CATEGORY_SELECT)
      .single();

    if (error) {
      throw error;
    }

    return fromCategoryRow(data);
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(CATEGORY_TABLE_NAME)
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }
  }

  async list(): Promise<MonthlyPatrimonyRecord[]> {
    const { data, error } = await this.supabase
      .from(RECORDS_TABLE_NAME)
      .select(RECORD_SELECT)
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
      .select(RECORD_SELECT)
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
      .select(RECORD_SELECT)
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

  private async nextCategoryDisplayOrder() {
    const { data, error } = await this.supabase
      .from(CATEGORY_TABLE_NAME)
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data?.display_order ?? 0) + 1;
  }
}

function fromRecordRow(row: PatrimonyRecordRow): MonthlyPatrimonyRecord {
  const category = Array.isArray(row.category) ? row.category[0] : row.category;

  if (!category) {
    throw new Error(`Patrimony record ${row.id} has no category.`);
  }

  return {
    id: row.id,
    recordDate: row.record_date,
    category: fromCategoryRow(category),
    amountCrc: Number(row.amount_crc),
    amountUsd: row.amount_usd === null ? null : Number(row.amount_usd),
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
    displayOrder: row.display_order,
    interestRate: row.interest_rate === null ? null : Number(row.interest_rate),
  };
}

function toInsertRow(input: PatrimonyRecordInput, now: string) {
  return {
    month: input.recordDate.slice(0, 7),
    record_date: input.recordDate,
    category_id: input.categoryId,
    amount_crc: input.amountCrc,
    amount_usd: input.amountUsd ?? null,
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
    amount_crc: input.amountCrc,
    amount_usd: input.amountUsd ?? null,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  };
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
