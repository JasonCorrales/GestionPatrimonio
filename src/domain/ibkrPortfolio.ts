export type IbkrMoney = {
  amount: string;
  currency: string;
};

export type IbkrPortfolioPosition = {
  accountId: string;
  conid: string;
  symbol: string | null;
  currency: string;
  quantity: string | null;
  multiplier: string | null;
  markPrice: string | null;
  positionValue: string | null;
  costBasisMoney: string | null;
  costBasisPrice: string | null;
  fifoPnlUnrealized: string | null;
};

export type IbkrPortfolioSnapshot = {
  userId: string;
  accountId: string;
  reportDate: string;
  generatedAt: string | null;
  nav: IbkrMoney | null;
  cash: IbkrMoney | null;
  positions: IbkrPortfolioPosition[];
};

export type IbkrSyncJobState =
  | "requested"
  | "pending"
  | "persisted"
  | "failed"
  | "expired";

export type IbkrSyncJobContract = {
  userId: string;
  state: IbkrSyncJobState;
  referenceCode: string | null;
  lastExternalCode: string | null;
  sanitizedMessage: string | null;
  attempts: number;
  nextAttemptAfter: string | null;
};
