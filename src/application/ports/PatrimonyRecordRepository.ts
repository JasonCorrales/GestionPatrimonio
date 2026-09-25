import type { MonthlyPatrimonyRecord, PatrimonyMovementType } from "@/domain/monthlyPatrimonyRecord";
import type { PatrimonyCategory } from "@/domain/patrimonyCategory";

export type PatrimonyRecordInput = {
  recordDate: string;
  categoryId: string;
  amountCrc: number;
  amountUsd?: number | null;
  movementType: PatrimonyMovementType;
  notes?: string;
};

export type PatrimonyCategoryInput = {
  name: string;
  interestRate?: number | null;
};

export interface PatrimonyRecordRepository {
  listCategories(): Promise<PatrimonyCategory[]>;
  createCategory(input: PatrimonyCategoryInput): Promise<PatrimonyCategory>;
  updateCategory(id: string, input: PatrimonyCategoryInput): Promise<PatrimonyCategory>;
  deleteCategory(id: string): Promise<void>;
  list(): Promise<MonthlyPatrimonyRecord[]>;
  save(input: PatrimonyRecordInput): Promise<MonthlyPatrimonyRecord>;
  update(id: string, input: PatrimonyRecordInput): Promise<MonthlyPatrimonyRecord>;
  delete(id: string): Promise<void>;
}
