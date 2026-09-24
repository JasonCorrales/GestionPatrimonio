export type RetirementCalculationInput = {
  initialBalance: number;
  periodicAmount: number;
  annualInterestRate: number;
  durationYears: number;
};

export type RetirementCalculationResult = {
  finalAmount: number;
  totalContributed: number;
  estimatedInterest: number;
  estimatedMonthlyAmount: number;
};

export type SavedRetirementCalculation = RetirementCalculationInput &
  RetirementCalculationResult & {
    id: string;
    createdAt: string;
  };

export function calculateRetirementProjection(
  input: RetirementCalculationInput,
): RetirementCalculationResult {
  const months = Math.max(0, Math.round(input.durationYears * 12));
  const monthlyRate = input.annualInterestRate / 100 / 12;
  let balance = input.initialBalance;

  for (let month = 0; month < months; month += 1) {
    balance = balance * (1 + monthlyRate) + input.periodicAmount;
  }

  const totalContributed = input.initialBalance + input.periodicAmount * months;
  const finalAmount = roundCurrency(balance);

  return {
    finalAmount,
    totalContributed: roundCurrency(totalContributed),
    estimatedInterest: roundCurrency(finalAmount - totalContributed),
    estimatedMonthlyAmount: roundCurrency(finalAmount / input.durationYears / 12),
  };
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
