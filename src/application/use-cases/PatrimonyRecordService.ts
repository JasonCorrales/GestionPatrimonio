import type { MonthlyPatrimonyRecord } from "@/domain/monthlyPatrimonyRecord";
import type { PatrimonyCategory } from "@/domain/patrimonyCategory";
import type {
  PatrimonyCategoryInput,
  PatrimonyRecordInput,
  PatrimonyRecordRepository,
} from "../ports/PatrimonyRecordRepository";

export type PatrimonyRecordValidationError = {
  field: string;
  message: string;
};

export type PatrimonyRecordView = MonthlyPatrimonyRecord;

export class PatrimonyRecordService {
  constructor(private readonly repository: PatrimonyRecordRepository) {}

  async listCategories(): Promise<PatrimonyCategory[]> {
    return this.repository.listCategories();
  }

  async createCategory(input: PatrimonyCategoryInput): Promise<PatrimonyCategory> {
    validatePatrimonyCategory(input);
    return this.repository.createCategory(normalizeCategoryInput(input));
  }

  async updateCategory(
    id: string,
    input: PatrimonyCategoryInput,
  ): Promise<PatrimonyCategory> {
    if (!id) {
      throw new Error("Category id is required.");
    }

    validatePatrimonyCategory(input);
    return this.repository.updateCategory(id, normalizeCategoryInput(input));
  }

  async deleteCategory(id: string): Promise<void> {
    if (!id) {
      throw new Error("Category id is required.");
    }

    await this.repository.deleteCategory(id);
  }

  async listRecords(): Promise<PatrimonyRecordView[]> {
    const records = await this.repository.list();

    return records.sort((left, right) =>
      right.recordDate.localeCompare(left.recordDate),
    );
  }

  async createRecord(input: PatrimonyRecordInput): Promise<PatrimonyRecordView> {
    const errors = validatePatrimonyRecord(input);

    if (errors.length > 0) {
      throw new PatrimonyRecordValidationException(errors);
    }

    return this.repository.save(input);
  }

  async createRecords(inputs: PatrimonyRecordInput[]): Promise<PatrimonyRecordView[]> {
    const createdRecords: PatrimonyRecordView[] = [];

    for (const input of inputs) {
      createdRecords.push(await this.createRecord(input));
    }

    return createdRecords;
  }

  async updateRecord(
    id: string,
    input: PatrimonyRecordInput,
  ): Promise<PatrimonyRecordView> {
    const errors = validatePatrimonyRecord(input);

    if (errors.length > 0) {
      throw new PatrimonyRecordValidationException(errors);
    }

    return this.repository.update(id, input);
  }

  async deleteRecord(id: string): Promise<void> {
    if (!id) {
      throw new Error("Record id is required.");
    }

    await this.repository.delete(id);
  }
}

export class PatrimonyRecordValidationException extends Error {
  constructor(public readonly errors: PatrimonyRecordValidationError[]) {
    super("Patrimony record validation failed");
  }
}

export function validatePatrimonyRecord(
  input: PatrimonyRecordInput,
): PatrimonyRecordValidationError[] {
  const errors: PatrimonyRecordValidationError[] = [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.recordDate)) {
    errors.push({ field: "recordDate", message: "Date must use YYYY-MM-DD format." });
  }

  if (!input.categoryId) {
    errors.push({ field: "categoryId", message: "Category is required." });
  }

  if (!Number.isFinite(input.amountCrc) || input.amountCrc < 0) {
    errors.push({
      field: "amountCrc",
      message: "CRC amount must be a positive number or zero.",
    });
  }

  if (
    input.amountUsd !== null &&
    input.amountUsd !== undefined &&
    (!Number.isFinite(input.amountUsd) || input.amountUsd < 0)
  ) {
    errors.push({
      field: "amountUsd",
      message: "USD amount must be a positive number or zero.",
    });
  }

  if (!["contribution", "interest"].includes(input.movementType)) {
    errors.push({
      field: "movementType",
      message: "Movement type is required.",
    });
  }

  return errors;
}

function validatePatrimonyCategory(input: PatrimonyCategoryInput) {
  if (!input.name.trim()) {
    throw new Error("Category name is required.");
  }

  if (
    input.interestRate !== null &&
    input.interestRate !== undefined &&
    (!Number.isFinite(input.interestRate) || input.interestRate < 0)
  ) {
    throw new Error("Category interest rate must be zero or greater.");
  }
}

function normalizeCategoryInput(input: PatrimonyCategoryInput): PatrimonyCategoryInput {
  return {
    name: input.name.trim(),
    interestRate: input.interestRate ?? null,
  };
}
