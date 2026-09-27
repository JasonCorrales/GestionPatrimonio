import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const BACKUP_SCHEMA_VERSION = 1;
const BACKUP_SOURCE = "GestionPatrimonio";
const CATEGORY_TABLE_NAME = "category";
const RECORDS_TABLE_NAME = "monthly_patrimony_records";
const RETIREMENT_TABLE_NAME = "retirement_calculations";

const CATEGORY_COLUMNS = "id";

type BackupPayload = {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  source: typeof BACKUP_SOURCE;
  data: {
    categories: BackupCategory[];
    patrimonyRecords: BackupPatrimonyRecord[];
    retirementCalculations: BackupRetirementCalculation[];
  };
};

type BackupCategory = {
  id: string;
  code: string;
  name: string;
  display_order: number;
  interest_rate: NumericValue | null;
};

type BackupPatrimonyRecord = {
  record_date: string;
  category_id: string;
  amount_crc: NumericValue;
  amount_usd: NumericValue | null;
  movement_type: "contribution" | "interest" | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type BackupRetirementCalculation = {
  initial_balance: NumericValue;
  periodic_amount: NumericValue;
  annual_interest_rate: NumericValue;
  duration_years: NumericValue;
  final_amount: NumericValue;
  total_contributed: NumericValue;
  estimated_interest: NumericValue;
  estimated_monthly_amount: NumericValue;
  created_at: string | null;
};

type NumericValue = number | string;

type BackupDatabase = {
  public: {
    Tables: {
      category: {
        Row: {
          id: string;
          code: string;
          name: string;
          display_order: number;
          interest_rate: NumericValue | null;
        };
        Insert: {
          code: string;
          name: string;
          display_order: number;
          interest_rate: NumericValue | null;
        };
        Update: never;
        Relationships: [];
      };
      monthly_patrimony_records: {
        Row: { id: string };
        Insert: {
          month: string;
          record_date: string;
          category_id: string;
          amount_crc: NumericValue;
          amount_usd: NumericValue | null;
          movement_type: "contribution" | "interest" | null;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Update: never;
        Relationships: [];
      };
      retirement_calculations: {
        Row: { id: string };
        Insert: BackupRetirementCalculation;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type BackupSupabaseClient = SupabaseClient<BackupDatabase>;

type ImportSummary = {
  categories: number;
  patrimonyRecords: number;
  retirementCalculations: number;
};

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse("Supabase credentials are not configured.", 503);
  }

  const accessToken = getBearerToken(request.headers.get("authorization"));

  if (!accessToken) {
    return errorResponse("A valid Supabase session is required to import backups.", 401);
  }

  const payload = await parseJsonPayload(request);

  if (!payload.ok) {
    return errorResponse(payload.error, 400);
  }

  const backup = validateBackupPayload(payload.value);

  if (!backup.ok) {
    return errorResponse(backup.error, 400);
  }

  const supabase = createClient<BackupDatabase>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return errorResponse("The current session could not be validated.", 401);
  }

  const deleteError = await deleteCurrentUserData(supabase);

  if (deleteError) {
    return errorResponse(`Backup import failed while clearing current data: ${deleteError}`, 502);
  }

  const restoreResult = await restoreBackupData(supabase, backup.value);

  if (!restoreResult.ok) {
    return errorResponse(`Backup import failed: ${restoreResult.error}`, 502);
  }

  return NextResponse.json(restoreResult.summary, { headers: NO_STORE_HEADERS });
}

async function parseJsonPayload(request: NextRequest): Promise<Result<unknown>> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false, error: "The request body must be valid JSON." };
  }
}

function validateBackupPayload(payload: unknown): Result<BackupPayload> {
  if (!isRecord(payload)) {
    return { ok: false, error: "Backup payload must be a JSON object." };
  }

  if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: "Only schemaVersion 1 backups can be imported." };
  }

  if (payload.source !== BACKUP_SOURCE) {
    return { ok: false, error: "Backup source must be GestionPatrimonio." };
  }

  if (!isRecord(payload.data)) {
    return { ok: false, error: "Backup data must be a JSON object." };
  }

  const { categories, patrimonyRecords, retirementCalculations } = payload.data;

  if (!Array.isArray(categories) || !Array.isArray(patrimonyRecords) || !Array.isArray(retirementCalculations)) {
    return {
      ok: false,
      error: "Backup data must include categories, patrimonyRecords, and retirementCalculations arrays.",
    };
  }

  const parsedCategories = parseCategories(categories);
  if (!parsedCategories.ok) {
    return parsedCategories;
  }

  const parsedRecords = parsePatrimonyRecords(patrimonyRecords, new Set(parsedCategories.value.map((category) => category.id)));
  if (!parsedRecords.ok) {
    return parsedRecords;
  }

  const parsedRetirementCalculations = parseRetirementCalculations(retirementCalculations);
  if (!parsedRetirementCalculations.ok) {
    return parsedRetirementCalculations;
  }

  return {
    ok: true,
    value: {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      source: BACKUP_SOURCE,
      data: {
        categories: parsedCategories.value,
        patrimonyRecords: parsedRecords.value,
        retirementCalculations: parsedRetirementCalculations.value,
      },
    },
  };
}

function parseCategories(categories: unknown[]): Result<BackupCategory[]> {
  const seenIds = new Set<string>();
  const parsed: BackupCategory[] = [];

  for (const [index, category] of categories.entries()) {
    if (!isRecord(category)) {
      return { ok: false, error: `Category at index ${index} must be an object.` };
    }

    if (!isNonEmptyString(category.id) || seenIds.has(category.id)) {
      return { ok: false, error: `Category at index ${index} must have a unique id.` };
    }

    if (!isNonEmptyString(category.code) || !isNonEmptyString(category.name)) {
      return { ok: false, error: `Category at index ${index} must include code and name.` };
    }

    if (!isInteger(category.display_order)) {
      return { ok: false, error: `Category at index ${index} must include an integer display_order.` };
    }

    if (!isNullableNumeric(category.interest_rate)) {
      return { ok: false, error: `Category at index ${index} must include a numeric or null interest_rate.` };
    }

    seenIds.add(category.id);
    parsed.push({
      id: category.id,
      code: category.code,
      name: category.name,
      display_order: category.display_order,
      interest_rate: category.interest_rate,
    });
  }

  return { ok: true, value: parsed };
}

function parsePatrimonyRecords(records: unknown[], categoryIds: Set<string>): Result<BackupPatrimonyRecord[]> {
  const parsed: BackupPatrimonyRecord[] = [];

  for (const [index, record] of records.entries()) {
    if (!isRecord(record)) {
      return { ok: false, error: `Patrimony record at index ${index} must be an object.` };
    }

    if (!isDateString(record.record_date)) {
      return { ok: false, error: `Patrimony record at index ${index} must include record_date as YYYY-MM-DD.` };
    }

    if (!isNonEmptyString(record.category_id) || !categoryIds.has(record.category_id)) {
      return { ok: false, error: `Patrimony record at index ${index} references an unknown category_id.` };
    }

    if (!isNumeric(record.amount_crc) || !isNullableNumeric(record.amount_usd)) {
      return { ok: false, error: `Patrimony record at index ${index} must include valid amounts.` };
    }

    if (record.movement_type !== "contribution" && record.movement_type !== "interest" && record.movement_type !== null) {
      return { ok: false, error: `Patrimony record at index ${index} has an invalid movement_type.` };
    }

    if (!isNullableString(record.notes) || !isNullableString(record.created_at) || !isNullableString(record.updated_at)) {
      return { ok: false, error: `Patrimony record at index ${index} has invalid notes or timestamps.` };
    }

    parsed.push({
      record_date: record.record_date,
      category_id: record.category_id,
      amount_crc: record.amount_crc,
      amount_usd: record.amount_usd,
      movement_type: record.movement_type,
      notes: record.notes,
      created_at: record.created_at,
      updated_at: record.updated_at,
    });
  }

  return { ok: true, value: parsed };
}

function parseRetirementCalculations(calculations: unknown[]): Result<BackupRetirementCalculation[]> {
  const parsed: BackupRetirementCalculation[] = [];

  for (const [index, calculation] of calculations.entries()) {
    if (!isRecord(calculation)) {
      return { ok: false, error: `Retirement calculation at index ${index} must be an object.` };
    }

    const {
      initial_balance,
      periodic_amount,
      annual_interest_rate,
      duration_years,
      final_amount,
      total_contributed,
      estimated_interest,
      estimated_monthly_amount,
      created_at,
    } = calculation;

    if (
      !isNumeric(initial_balance) ||
      !isNumeric(periodic_amount) ||
      !isNumeric(annual_interest_rate) ||
      !isNumeric(duration_years) ||
      !isNumeric(final_amount) ||
      !isNumeric(total_contributed) ||
      !isNumeric(estimated_interest) ||
      !isNumeric(estimated_monthly_amount)
    ) {
      return { ok: false, error: `Retirement calculation at index ${index} must include all numeric fields.` };
    }

    if (!isNullableString(created_at)) {
      return { ok: false, error: `Retirement calculation at index ${index} has an invalid created_at timestamp.` };
    }

    parsed.push({
      initial_balance,
      periodic_amount,
      annual_interest_rate,
      duration_years,
      final_amount,
      total_contributed,
      estimated_interest,
      estimated_monthly_amount,
      created_at,
    });
  }

  return { ok: true, value: parsed };
}

async function deleteCurrentUserData(supabase: BackupSupabaseClient) {
  const recordsResult = await supabase.from(RECORDS_TABLE_NAME).delete().not("id", "is", null);
  if (recordsResult.error) {
    return recordsResult.error.message;
  }

  const retirementResult = await supabase.from(RETIREMENT_TABLE_NAME).delete().not("id", "is", null);
  if (retirementResult.error) {
    return retirementResult.error.message;
  }

  const categoriesResult = await supabase.from(CATEGORY_TABLE_NAME).delete().not("id", "is", null);
  if (categoriesResult.error) {
    return categoriesResult.error.message;
  }

  return undefined;
}

async function restoreBackupData(supabase: BackupSupabaseClient, backup: BackupPayload): Promise<RestoreResult> {
  const categoryIdMap = new Map<string, string>();
  for (const category of backup.data.categories) {
    const { data, error } = await supabase
      .from(CATEGORY_TABLE_NAME)
      .insert({
        code: category.code,
        name: category.name,
        display_order: category.display_order,
        interest_rate: category.interest_rate,
      })
      .select(CATEGORY_COLUMNS)
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data?.id) {
      return { ok: false, error: "A restored category did not return an id." };
    }

    categoryIdMap.set(category.id, data.id);
  }

  const recordRows = backup.data.patrimonyRecords.map((record) => {
    const categoryId = categoryIdMap.get(record.category_id);

    if (!categoryId) {
      throw new Error("A patrimony record references a category that was not restored.");
    }

    return {
      month: record.record_date.slice(0, 7),
      record_date: record.record_date,
      category_id: categoryId,
      amount_crc: record.amount_crc,
      amount_usd: record.amount_usd,
      movement_type: record.movement_type,
      notes: record.notes,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  });

  if (recordRows.length > 0) {
    const { error } = await supabase.from(RECORDS_TABLE_NAME).insert(recordRows);

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  const retirementRows = backup.data.retirementCalculations.map((calculation) => ({
    initial_balance: calculation.initial_balance,
    periodic_amount: calculation.periodic_amount,
    annual_interest_rate: calculation.annual_interest_rate,
    duration_years: calculation.duration_years,
    final_amount: calculation.final_amount,
    total_contributed: calculation.total_contributed,
    estimated_interest: calculation.estimated_interest,
    estimated_monthly_amount: calculation.estimated_monthly_amount,
    created_at: calculation.created_at,
  }));

  if (retirementRows.length > 0) {
    const { error } = await supabase.from(RETIREMENT_TABLE_NAME).insert(retirementRows);

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  return {
    ok: true,
    summary: {
      categories: backup.data.categories.length,
      patrimonyRecords: backup.data.patrimonyRecords.length,
      retirementCalculations: backup.data.retirementCalculations.length,
    },
  };
}

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
}

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: NO_STORE_HEADERS,
    },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

function isNumeric(value: unknown): value is NumericValue {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value));
}

function isNullableNumeric(value: unknown): value is NumericValue | null {
  return value === null || isNumeric(value);
}

type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

type RestoreResult =
  | { ok: true; summary: ImportSummary }
  | { ok: false; error: string };
