import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("supabase/migrations/013_add_emergency_fund_investment_type.sql", "utf8");

test("emergency fund migration expands the investment type constraint", () => {
  assert.match(sql, /drop constraint if exists monthly_patrimony_records_investment_type_check/i);
  assert.match(
    sql,
    /add constraint monthly_patrimony_records_investment_type_check\s+check \(investment_type in \('fixed_income', 'variable_income', 'emergency_fund'\)\)/i,
  );
  assert.match(sql, /notify pgrst, 'reload schema'/i);
});
