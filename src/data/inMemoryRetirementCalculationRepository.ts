import type {
  RetirementCalculationRepository,
  SaveRetirementCalculationInput,
} from "@/application/ports/RetirementCalculationRepository";
import type { SavedRetirementCalculation } from "@/domain/retirementCalculation";

export class InMemoryRetirementCalculationRepository
  implements RetirementCalculationRepository
{
  private calculations: SavedRetirementCalculation[] = [];

  async list(): Promise<SavedRetirementCalculation[]> {
    return [...this.calculations];
  }

  async getActive(): Promise<SavedRetirementCalculation | null> {
    return this.calculations.find((item) => item.isActive) ?? null;
  }

  async save(
    input: SaveRetirementCalculationInput,
  ): Promise<SavedRetirementCalculation> {
    const calculation: SavedRetirementCalculation = {
      id: crypto.randomUUID(),
      ...input,
      isActive: input.isActive || !this.calculations.some((item) => item.isActive),
      createdAt: new Date().toISOString(),
    };

    this.calculations = calculation.isActive
      ? [calculation, ...this.calculations.map((item) => ({ ...item, isActive: false }))]
      : [calculation, ...this.calculations];

    return calculation;
  }

  async setActive(id: string): Promise<SavedRetirementCalculation> {
    const target = this.calculations.find((item) => item.id === id);

    if (!target) {
      throw new Error(`Retirement calculation not found: ${id}`);
    }

    this.calculations = this.calculations.map((item) => ({
      ...item,
      isActive: item.id === id,
    }));

    return { ...target, isActive: true };
  }

  async delete(id: string): Promise<void> {
    const target = this.calculations.find((item) => item.id === id);

    if (!target) {
      throw new Error(`Retirement calculation not found: ${id}`);
    }

    this.calculations = this.calculations.filter((item) => item.id !== id);

    if (target.isActive && this.calculations.length > 0) {
      const [nextActive, ...rest] = this.calculations;
      this.calculations = [{ ...nextActive, isActive: true }, ...rest];
    }
  }
}
