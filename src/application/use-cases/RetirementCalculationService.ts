import {
  calculateRetirementProjection,
  type RetirementCalculationInput,
  type SavedRetirementCalculation,
} from "@/domain/retirementCalculation";
import type { RetirementCalculationRepository } from "../ports/RetirementCalculationRepository";

export class RetirementCalculationService {
  constructor(private readonly repository: RetirementCalculationRepository) {}

  calculate(input: RetirementCalculationInput) {
    validateRetirementCalculation(input);
    return calculateRetirementProjection(input);
  }

  async listSavedCalculations(): Promise<SavedRetirementCalculation[]> {
    const calculations = await this.repository.list();
    return calculations.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  async saveCalculation(
    input: RetirementCalculationInput,
  ): Promise<SavedRetirementCalculation> {
    validateRetirementCalculation(input);
    const result = calculateRetirementProjection(input);
    return this.repository.save({ ...input, ...result });
  }

  async deleteCalculation(id: string): Promise<void> {
    if (!id) {
      throw new Error("Retirement calculation id is required.");
    }

    await this.repository.delete(id);
  }
}

export function validateRetirementCalculation(input: RetirementCalculationInput) {
  if (!Number.isFinite(input.initialBalance) || input.initialBalance < 0) {
    throw new Error("Initial balance must be zero or greater.");
  }

  if (!Number.isFinite(input.periodicAmount) || input.periodicAmount < 0) {
    throw new Error("Periodic amount must be zero or greater.");
  }

  if (!Number.isFinite(input.annualInterestRate) || input.annualInterestRate < 0) {
    throw new Error("Annual interest rate must be zero or greater.");
  }

  if (!Number.isFinite(input.durationYears) || input.durationYears <= 0) {
    throw new Error("Duration must be greater than zero.");
  }
}
