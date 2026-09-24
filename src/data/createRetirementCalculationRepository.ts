import type { RetirementCalculationRepository } from "@/application/ports/RetirementCalculationRepository";
import { InMemoryRetirementCalculationRepository } from "./inMemoryRetirementCalculationRepository";
import { SupabaseRetirementCalculationRepository } from "./supabase/SupabaseRetirementCalculationRepository";
import { getSupabaseBrowserClient } from "./supabase/client";
import { getConfiguredDataSource } from "./createPatrimonyRecordRepository";

export function createRetirementCalculationRepository(): RetirementCalculationRepository {
  const dataSource = getConfiguredDataSource();

  if (dataSource === "supabase") {
    return new SupabaseRetirementCalculationRepository(getSupabaseBrowserClient());
  }

  return new InMemoryRetirementCalculationRepository();
}
