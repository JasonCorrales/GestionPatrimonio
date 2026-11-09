export type InvestmentDistributionRecord = {
  investmentType: "fixed_income" | "variable_income" | "emergency_fund";
  categoryCode: string;
  amount: number;
};

export type InvestmentDistributionItem = {
  id: "fixed_income" | "variable_income" | "emergency_fund";
  label: string;
  amount: number;
  percentage: number;
  color: string;
};

const distributionItems: Array<Pick<InvestmentDistributionItem, "id" | "label" | "color">> = [
  { id: "fixed_income", label: "Renta fija", color: "#2458d3" },
  { id: "variable_income", label: "Renta variable", color: "#32a6a6" },
  { id: "emergency_fund", label: "Fondo de emergencia", color: "#f59e0b" },
];

export function buildInvestmentDistribution(
  records: InvestmentDistributionRecord[],
): InvestmentDistributionItem[] {
  if (records.length === 0) {
    return [];
  }

  const totals: Record<InvestmentDistributionItem["id"], number> = {
    fixed_income: 0,
    variable_income: 0,
    emergency_fund: 0,
  };

  for (const record of records) {
    totals[record.investmentType] += record.amount;
  }

  const total = totals.fixed_income + totals.variable_income + totals.emergency_fund;

  return distributionItems.map((item) => ({
    ...item,
    amount: totals[item.id],
    percentage: total > 0 ? (totals[item.id] / total) * 100 : 0,
  }));
}
