import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("accepts emergency_fund through the existing monthly record validation path", () => {
  const service = readFileSync("src/application/use-cases/PatrimonyRecordService.ts", "utf8");

  assert.match(service, /\["fixed_income", "variable_income", "emergency_fund"\]\.includes\(input\.investmentType\)/);
});

test("offers Fondo de emergencia in the monthly record form", () => {
  const records = readFileSync("src/ui/components/PatrimonyRecords.tsx", "utf8");

  assert.match(records, /<option value="emergency_fund">Fondo de emergencia<\/option>/);
});

test("imports Fondo de emergencia using the existing normalized investment type parser", () => {
  const importer = readFileSync("src/ui/components/PatrimonyBulkImport.tsx", "utf8");

  assert.match(importer, /\["fondo de emergencia", "emergency fund", "emergency_fund"\]/);
  assert.match(importer, /return "emergency_fund"/);
});

test("keeps fixed-income defaults and variable-income import aliases", () => {
  const importer = readFileSync("src/ui/components/PatrimonyBulkImport.tsx", "utf8");
  const records = readFileSync("src/ui/components/PatrimonyRecords.tsx", "utf8");

  assert.match(importer, /\["", "renta fija", "fixed income", "fixed_income", "fija"\]/);
  assert.match(importer, /\["renta variable", "variable income", "variable_income", "variable"\]/);
  assert.match(records, /useState<InvestmentTypeFormValue>\("fixed_income"\)/);
});
