import type {
  RetirementCalculationInput,
  RetirementCalculationResult,
  SavedRetirementCalculation,
} from "@/domain/retirementCalculation";

export type SaveRetirementCalculationInput = RetirementCalculationInput &
  RetirementCalculationResult & {
    description: string;
    isActive: boolean;
  };

export interface RetirementCalculationRepository {
  list(): Promise<SavedRetirementCalculation[]>;
  getActive(): Promise<SavedRetirementCalculation | null>;
  save(input: SaveRetirementCalculationInput): Promise<SavedRetirementCalculation>;
  setActive(id: string): Promise<SavedRetirementCalculation>;
  delete(id: string): Promise<void>;
}
