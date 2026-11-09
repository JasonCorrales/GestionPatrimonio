import assert from "node:assert/strict";
import test from "node:test";

const categoryIds = new Set(["backup-category"]);

function record(investment_type: unknown) {
  return {
    record_date: "2025-01-31",
    category_id: "backup-category",
    amount_crc: 100,
    amount_usd: null,
    movement_type: "contribution",
    investment_type,
    notes: null,
    created_at: null,
    updated_at: null,
  };
}

test("backup records export, validate, and restore every investment type", async (t) => {
  t.mock.module("next/server.js", {
    namedExports: {
      NextResponse: { json: () => undefined },
    },
  });
  // @ts-expect-error TS5097: native Node TypeScript import requires the .ts suffix.
  const { buildBackupPayload, PATRIMONY_RECORDS_SELECT } = await import("../../src/app/api/backups/export/route.ts");
  // @ts-expect-error TS5097: native Node TypeScript import requires the .ts suffix.
  const { parsePatrimonyRecords, restoreBackupData } = await import("../../src/app/api/backups/import/route.ts");

  const records = [
    record("fixed_income"),
    record("variable_income"),
    record("emergency_fund"),
  ];
  const backup = buildBackupPayload({
    exportedAt: "2025-02-01T00:00:00.000Z",
    user: { id: "user-1", email: null },
    data: {
      categories: [],
      patrimonyRecords: records,
      retirementCalculations: [],
    },
  });

  assert.match(PATRIMONY_RECORDS_SELECT, /\binvestment_type\b/);
  assert.deepEqual(backup.data.patrimonyRecords, records);

  const parsed = parsePatrimonyRecords(records, categoryIds);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.value.map((item) => item.investment_type), ["fixed_income", "variable_income", "emergency_fund"]);

  const insertedRows: unknown[][] = [];
  const supabase = {
    from(table: string) {
      if (table === "category") {
        return {
          insert() {
            return {
              select() {
                return { single: async () => ({ data: { id: "restored-category" }, error: null }) };
              },
            };
          },
        };
      }

      return {
        insert(rows: unknown[]) {
          insertedRows.push(rows);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  const result = await restoreBackupData(supabase as never, {
    schemaVersion: 1,
    source: "GestionPatrimonio",
    data: {
      categories: [{ id: "backup-category", code: "savings", name: "Savings", display_order: 1, interest_rate: null }],
      patrimonyRecords: parsed.value,
      retirementCalculations: [],
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    (insertedRows[0] as Array<{ category_id: string; investment_type: string }>).map((item) => ({
      category_id: item.category_id,
      investment_type: item.investment_type,
    })),
    [
      { category_id: "restored-category", investment_type: "fixed_income" },
      { category_id: "restored-category", investment_type: "variable_income" },
      { category_id: "restored-category", investment_type: "emergency_fund" },
    ],
  );

  const invalid = parsePatrimonyRecords([record("unsupported")], categoryIds);
  assert.deepEqual(invalid, {
    ok: false,
    error: "Patrimony record at index 0 has an invalid investment_type.",
  });
  assert.equal(insertedRows.length, 1);

  const legacyRecord = record(undefined);
  delete legacyRecord.investment_type;
  const legacy = parsePatrimonyRecords([legacyRecord], categoryIds);
  assert.equal(legacy.ok, true);
  if (!legacy.ok) return;
  assert.equal(legacy.value[0].investment_type, "fixed_income");

  const legacyRestore = await restoreBackupData(supabase as never, {
    schemaVersion: 1,
    source: "GestionPatrimonio",
    data: {
      categories: [{ id: "backup-category", code: "savings", name: "Savings", display_order: 1, interest_rate: null }],
      patrimonyRecords: legacy.value,
      retirementCalculations: [],
    },
  });
  assert.equal(legacyRestore.ok, true);
  assert.deepEqual(insertedRows[1], [{
    month: "2025-01",
    record_date: "2025-01-31",
    category_id: "restored-category",
    amount_crc: 100,
    amount_usd: null,
    movement_type: "contribution",
    investment_type: "fixed_income",
    notes: null,
    created_at: null,
    updated_at: null,
  }]);
});
