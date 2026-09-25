import type { PatrimonyCategory } from "./patrimonyCategory";

export type MonthlyPatrimonyRecord = {
  id: string;
  recordDate: string;
  category: PatrimonyCategory;
  amountCrc: number;
  amountUsd: number | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
