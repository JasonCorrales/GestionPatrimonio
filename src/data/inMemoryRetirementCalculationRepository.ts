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

  async save(
    input: SaveRetirementCalculationInput,
  ): Promise<SavedRetirementCalculation> {
    const calculation: SavedRetirementCalculation = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };

    this.calculations = [calculation, ...this.calculations];
    return calculation;
  }

  async delete(id: string): Promise<void> {
    const initialCount = this.calculations.length;
    this.calculations = this.calculations.filter((item) => item.id !== id);

    if (this.calculations.length === initialCount) {
      throw new Error(`Retirement calculation not found: ${id}`);
    }
  }
}
