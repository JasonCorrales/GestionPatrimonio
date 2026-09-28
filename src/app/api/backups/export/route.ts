import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const BACKUP_SCHEMA_VERSION = 1;
const CATEGORY_TABLE_NAME = "category";
const RECORDS_TABLE_NAME = "monthly_patrimony_records";
const RETIREMENT_TABLE_NAME = "retirement_calculations";

type BackupPayload = {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  source: "GestionPatrimonio";
  user: {
    id: string;
    email: string | null;
  };
  data: {
    categories: unknown[];
    patrimonyRecords: unknown[];
    retirementCalculations: unknown[];
  };
};

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse("Supabase credentials are not configured.", 503);
  }

  const accessToken = getBearerToken(request.headers.get("authorization"));

  if (!accessToken) {
    return errorResponse("A valid Supabase session is required to export backups.", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

  const [categoriesResult, recordsResult, retirementResult] = await Promise.all([
    supabase
      .from(CATEGORY_TABLE_NAME)
      .select("id, code, name, display_order, interest_rate")
      .order("display_order", { ascending: true }),
    supabase
      .from(RECORDS_TABLE_NAME)
      .select("id, month, record_date, category_id, amount_crc, amount_usd, movement_type, notes, created_at, updated_at")
      .order("record_date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from(RETIREMENT_TABLE_NAME)
      .select("id, description, is_active, initial_balance, periodic_amount, annual_interest_rate, duration_years, final_amount, total_contributed, estimated_interest, estimated_monthly_amount, created_at")
      .order("created_at", { ascending: true }),
  ]);

  const firstError = categoriesResult.error ?? recordsResult.error ?? retirementResult.error;

  if (firstError) {
    return errorResponse(`Backup export failed: ${firstError.message}`, 502);
  }

  const exportedAt = new Date().toISOString();
  const backup: BackupPayload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    source: "GestionPatrimonio",
    user: {
      id: userData.user.id,
      email: userData.user.email ?? null,
    },
    data: {
      categories: categoriesResult.data ?? [],
      patrimonyRecords: recordsResult.data ?? [],
      retirementCalculations: retirementResult.data ?? [],
    },
  };

  return NextResponse.json(backup, {
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Disposition": `attachment; filename="${buildBackupFilename(exportedAt)}"`,
    },
  });
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

function buildBackupFilename(exportedAt: string) {
  return `gestion-patrimonio-backup-${exportedAt.slice(0, 10)}.json`;
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
