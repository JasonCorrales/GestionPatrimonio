import "server-only";

import { IbkrPortfolioService } from "../../application/use-cases/IbkrPortfolioService";
import { IbkrFlexClient, parseFlexStatement } from "./flex";
import { createIbkrPortfolioRepository } from "./portfolioRepository";
import type { AuthorizedIbkrOwner } from "./auth";

export function createIbkrPortfolioService(auth: AuthorizedIbkrOwner) {
  return new IbkrPortfolioService({
    ownerUserId: auth.ownerUserId,
    repository: createIbkrPortfolioRepository({
      supabaseUrl: auth.config.supabaseUrl,
      supabaseServiceRoleKey: auth.config.supabaseServiceRoleKey,
    }),
    flexClient: new IbkrFlexClient({
      token: auth.config.ibkrFlexToken,
      queryId: auth.config.ibkrFlexQueryId,
    }),
    parseStatement: parseFlexStatement,
  });
}
