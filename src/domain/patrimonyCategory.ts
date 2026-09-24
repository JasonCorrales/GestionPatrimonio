export const PATRIMONY_CATEGORY_SEED = [
  { code: "stock_investment", name: "Inversion Bolsa" },
  { code: "term_certificate", name: "Certificados a Plazo" },
  { code: "solidarist_association", name: "Asociaciones solidaristas" },
  { code: "emergency_fund", name: "Fondo de Emergencia" },
  { code: "capital_social", name: "Capital Social" },
] as const;

export type PatrimonyCategoryCode = (typeof PATRIMONY_CATEGORY_SEED)[number]["code"];

export type PatrimonyCategory = {
  id: string;
  code: PatrimonyCategoryCode | string;
  name: string;
  displayOrder: number;
};

export const DEMO_PATRIMONY_CATEGORIES: PatrimonyCategory[] =
  PATRIMONY_CATEGORY_SEED.map((category, index) => ({
    id: category.code,
    displayOrder: index + 1,
    ...category,
  }));
