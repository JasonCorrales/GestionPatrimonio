import type {
  RetirementCalculationInput,
  RetirementCalculationResult,
  SavedRetirementCalculation,
} from "@/domain/retirementCalculation";

export type SaveRetirementCalculationInput = RetirementCalculationInput &
  RetirementCalculationResult;

export interface RetirementCalculationRepository {
  list(): Promise<SavedRetirementCalculation[]>;
  save(input: SaveRetirementCalculationInput): Promise<SavedRetirementCalculation>;
  delete(id: string): Promise<void>;
}
