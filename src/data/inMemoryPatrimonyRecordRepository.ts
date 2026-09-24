import type {
  PatrimonyRecordInput,
  PatrimonyRecordRepository,
} from "@/application/ports/PatrimonyRecordRepository";
import {
  DEMO_PATRIMONY_CATEGORIES,
  type PatrimonyCategory,
} from "@/domain/patrimonyCategory";
import type { MonthlyPatrimonyRecord } from "@/domain/monthlyPatrimonyRecord";

const stockInvestmentCategory = DEMO_PATRIMONY_CATEGORIES[0];

const seedRecords: MonthlyPatrimonyRecord[] = [
  {
    id: "demo-2025-01-stock",
    recordDate: "2025-01-31",
    category: stockInvestmentCategory,
    amount: 12500,
    notes: "Demo record. Replace with Supabase persistence when configured.",
    createdAt: new Date("2025-01-31T12:00:00.000Z").toISOString(),
    updatedAt: new Date("2025-01-31T12:00:00.000Z").toISOString(),
  },
];

export class InMemoryPatrimonyRecordRepository
  implements PatrimonyRecordRepository
{
  private records = [...seedRecords];
  private categories = [...DEMO_PATRIMONY_CATEGORIES];

  async listCategories(): Promise<PatrimonyCategory[]> {
    return [...this.categories];
  }

  async list(): Promise<MonthlyPatrimonyRecord[]> {
    return [...this.records];
  }

  async save(input: PatrimonyRecordInput): Promise<MonthlyPatrimonyRecord> {
    const now = new Date().toISOString();
    const category = this.findCategory(input.categoryId);
    const record: MonthlyPatrimonyRecord = {
      id: crypto.randomUUID(),
      recordDate: input.recordDate,
      category,
      amount: input.amount,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    this.records = [record, ...this.records];
    return record;
  }

  async update(
    id: string,
    input: PatrimonyRecordInput,
  ): Promise<MonthlyPatrimonyRecord> {
    const existing = this.records.find((record) => record.id === id);

    if (!existing) {
      throw new Error(`Patrimony record not found: ${id}`);
    }

    const updated: MonthlyPatrimonyRecord = {
      ...existing,
      recordDate: input.recordDate,
      category: this.findCategory(input.categoryId),
      amount: input.amount,
      notes: input.notes,
      updatedAt: new Date().toISOString(),
    };

    this.records = this.records.map((record) =>
      record.id === id ? updated : record,
    );

    return updated;
  }

  async delete(id: string): Promise<void> {
    const initialCount = this.records.length;
    this.records = this.records.filter((record) => record.id !== id);

    if (this.records.length === initialCount) {
      throw new Error(`Patrimony record not found: ${id}`);
    }
  }

  private findCategory(categoryId: string) {
    const category = this.categories.find((item) => item.id === categoryId);

    if (!category) {
      throw new Error(`Patrimony category not found: ${categoryId}`);
    }

    return category;
  }
}
