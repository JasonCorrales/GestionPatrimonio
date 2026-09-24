import type { MonthlyPatrimonyRecord } from "@/domain/monthlyPatrimonyRecord";
import type { PatrimonyCategory } from "@/domain/patrimonyCategory";
import type {
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

  if (!Number.isFinite(input.amount) || input.amount < 0) {
    errors.push({
      field: "amount",
      message: "Amount must be a positive number or zero.",
    });
  }

  return errors;
}
