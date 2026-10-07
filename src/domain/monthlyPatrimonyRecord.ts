import type { PatrimonyCategory } from "./patrimonyCategory";

export type PatrimonyMovementType = "contribution" | "interest";
export type PatrimonyInvestmentType = "fixed_income" | "variable_income";

export type MonthlyPatrimonyRecord = {
  id: string;
  recordDate: string;
  category: PatrimonyCategory;
  amountCrc: number;
  amountUsd: number | null;
  movementType: PatrimonyMovementType | null;
  investmentType: PatrimonyInvestmentType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
