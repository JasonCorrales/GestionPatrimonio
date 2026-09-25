import type {
  PatrimonyCategoryInput,
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
    amountCrc: 12500,
    amountUsd: null,
    movementType: "contribution",
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
    return [...this.categories].sort((left, right) =>
      left.displayOrder - right.displayOrder,
    );
  }

  async createCategory(input: PatrimonyCategoryInput): Promise<PatrimonyCategory> {
    this.ensureUniqueCategoryName(input.name);

    const category: PatrimonyCategory = {
      id: crypto.randomUUID(),
      code: slugify(input.name),
      name: input.name,
      displayOrder: nextDisplayOrder(this.categories),
      interestRate: input.interestRate ?? null,
    };

    this.categories = [...this.categories, category];
    return category;
  }

  async updateCategory(
    id: string,
    input: PatrimonyCategoryInput,
  ): Promise<PatrimonyCategory> {
    const existing = this.findCategory(id);
    this.ensureUniqueCategoryName(input.name, id);

    const updated: PatrimonyCategory = {
      ...existing,
      code: slugify(input.name),
      name: input.name,
      interestRate: input.interestRate ?? null,
    };

    this.categories = this.categories.map((category) =>
      category.id === id ? updated : category,
    );
    this.records = this.records.map((record) =>
      record.category.id === id ? { ...record, category: updated } : record,
    );

    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    const hasRecords = this.records.some((record) => record.category.id === id);

    if (hasRecords) {
      throw new Error("Cannot delete a category that has patrimony records.");
    }

    const initialCount = this.categories.length;
    this.categories = this.categories.filter((category) => category.id !== id);

    if (this.categories.length === initialCount) {
      throw new Error(`Patrimony category not found: ${id}`);
    }
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
      amountCrc: input.amountCrc,
      amountUsd: input.amountUsd ?? null,
      movementType: input.movementType,
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
      amountCrc: input.amountCrc,
      amountUsd: input.amountUsd ?? null,
      movementType: input.movementType,
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

  private ensureUniqueCategoryName(name: string, currentId?: string) {
    const normalizedName = name.toLocaleLowerCase();
    const duplicated = this.categories.some(
      (category) =>
        category.id !== currentId &&
        category.name.toLocaleLowerCase() === normalizedName,
    );

    if (duplicated) {
      throw new Error(`Patrimony category already exists: ${name}`);
    }
  }
}

function nextDisplayOrder(categories: PatrimonyCategory[]) {
  return Math.max(0, ...categories.map((category) => category.displayOrder)) + 1;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
