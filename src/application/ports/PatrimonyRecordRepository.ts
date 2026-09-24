import type { MonthlyPatrimonyRecord } from "@/domain/monthlyPatrimonyRecord";
import type { PatrimonyCategory } from "@/domain/patrimonyCategory";

export type PatrimonyRecordInput = {
  recordDate: string;
  categoryId: string;
  amount: number;
  notes?: string;
};

export interface PatrimonyRecordRepository {
  listCategories(): Promise<PatrimonyCategory[]>;
  list(): Promise<MonthlyPatrimonyRecord[]>;
  save(input: PatrimonyRecordInput): Promise<MonthlyPatrimonyRecord>;
  update(id: string, input: PatrimonyRecordInput): Promise<MonthlyPatrimonyRecord>;
}
