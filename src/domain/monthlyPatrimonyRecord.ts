import type { PatrimonyCategory } from "./patrimonyCategory";

export type MonthlyPatrimonyRecord = {
  id: string;
  recordDate: string;
  category: PatrimonyCategory;
  amount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
