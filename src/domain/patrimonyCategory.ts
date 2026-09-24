export const PATRIMONY_CATEGORY_SEED = [
  { code: "stock_investment", name: "Inversion Bolsa", interestRate: null },
  { code: "term_certificate", name: "Certificados a Plazo", interestRate: null },
  { code: "solidarist_association", name: "Asociaciones solidaristas", interestRate: null },
  { code: "emergency_fund", name: "Fondo de Emergencia", interestRate: null },
  { code: "capital_social", name: "Capital Social", interestRate: null },
] as const;

export type PatrimonyCategoryCode = (typeof PATRIMONY_CATEGORY_SEED)[number]["code"];

export type PatrimonyCategory = {
  id: string;
  code: PatrimonyCategoryCode | string;
  name: string;
  displayOrder: number;
  interestRate: number | null;
};

export const DEMO_PATRIMONY_CATEGORIES: PatrimonyCategory[] =
  PATRIMONY_CATEGORY_SEED.map((category, index) => ({
    id: category.code,
    displayOrder: index + 1,
    ...category,
  }));
