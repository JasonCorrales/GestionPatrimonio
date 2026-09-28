import {
  calculateRetirementProjection,
  type RetirementCalculationInput,
  type SavedRetirementCalculation,
} from "@/domain/retirementCalculation";
import type { RetirementCalculationRepository } from "../ports/RetirementCalculationRepository";

export type SaveRetirementCalculationRequest = RetirementCalculationInput & {
  description: string;
};

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

  async getActiveCalculation(): Promise<SavedRetirementCalculation | null> {
    return this.repository.getActive();
  }

  async saveCalculation(
    input: SaveRetirementCalculationRequest,
  ): Promise<SavedRetirementCalculation> {
    validateRetirementCalculation(input);
    const description = validateRetirementCalculationDescription(input.description);
    const result = calculateRetirementProjection(input);
    const activeCalculation = await this.repository.getActive();

    return this.repository.save({
      ...input,
      ...result,
      description,
      isActive: activeCalculation === null,
    });
  }

  async activateCalculation(id: string): Promise<SavedRetirementCalculation> {
    if (!id) {
      throw new Error("Retirement calculation id is required.");
    }

    return this.repository.setActive(id);
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

export function validateRetirementCalculationDescription(description: string) {
  const normalizedDescription = description.trim();

  if (!normalizedDescription) {
    throw new Error("Retirement calculation description is required.");
  }

  return normalizedDescription;
}
