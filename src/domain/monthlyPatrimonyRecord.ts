import type { PatrimonyCategory } from "./patrimonyCategory";

export type PatrimonyMovementType = "contribution" | "interest";

export type MonthlyPatrimonyRecord = {
  id: string;
  recordDate: string;
  category: PatrimonyCategory;
  amountCrc: number;
  amountUsd: number | null;
  movementType: PatrimonyMovementType | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
