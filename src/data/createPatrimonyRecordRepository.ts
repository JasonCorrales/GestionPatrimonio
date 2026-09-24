import type { PatrimonyRecordRepository } from "@/application/ports/PatrimonyRecordRepository";
import { InMemoryPatrimonyRecordRepository } from "./inMemoryPatrimonyRecordRepository";
import { SupabasePatrimonyRecordRepository } from "./supabase/SupabasePatrimonyRecordRepository";
import { getSupabaseBrowserClient } from "./supabase/client";

export type DataSource = "memory" | "supabase";

export function createPatrimonyRecordRepository(): PatrimonyRecordRepository {
  const dataSource = getConfiguredDataSource();

  if (dataSource === "supabase") {
    return new SupabasePatrimonyRecordRepository(getSupabaseBrowserClient());
  }

  return new InMemoryPatrimonyRecordRepository();
}

export function getConfiguredDataSource(): DataSource {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" && hasSupabaseConfiguration()
    ? "supabase"
    : "memory";
}

export function hasSupabaseConfiguration(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
