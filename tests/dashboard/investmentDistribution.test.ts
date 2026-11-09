import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner resolves explicit .ts imports.
import { buildInvestmentDistribution } from "../../src/ui/investmentDistribution.ts";

test("classifies records by selected investment type rather than category", () => {
  const distribution = buildInvestmentDistribution([
    { investmentType: "fixed_income", categoryCode: "term_certificate", amount: 100 },
    { investmentType: "variable_income", categoryCode: "emergency_fund", amount: 200 },
    { investmentType: "emergency_fund", categoryCode: "stock_investment", amount: 50 },
  ]);

  assert.deepEqual(distribution, [
    { id: "fixed_income", label: "Renta fija", amount: 100, percentage: 100 / 350 * 100, color: "#2458d3" },
    { id: "variable_income", label: "Renta variable", amount: 200, percentage: 200 / 350 * 100, color: "#32a6a6" },
    { id: "emergency_fund", label: "Fondo de emergencia", amount: 50, percentage: 50 / 350 * 100, color: "#f59e0b" },
  ]);
});

test("keeps Tipo de inversión and removes the Renta fija vs variable heading", () => {
  const dashboard = readFileSync("src/ui/components/DashboardHome.tsx", "utf8");

  assert.match(dashboard, /Tipo de inversión/);
  assert.doesNotMatch(dashboard, /Renta fija vs variable/);
});
