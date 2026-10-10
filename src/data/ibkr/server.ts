import "server-only";

import {
  authorizeIbkrOwnerPure,
  getIbkrServerConfigFromEnv,
  toSafePortfolioStatus,
  type AuthorizedIbkrOwner,
  type IbkrAuthFailure,
  type IbkrServerConfig,
  type SafeIbkrStatusInput,
} from "./auth";

export type {
  AuthorizedIbkrOwner,
  IbkrAuthFailure,
  IbkrServerConfig,
  SafeIbkrStatusInput,
};

export { toSafePortfolioStatus };

export function getIbkrServerConfig(): IbkrServerConfig {
  return getIbkrServerConfigFromEnv(process.env);
}

export async function authorizeIbkrOwner({
  authorization,
  config = getIbkrServerConfig(),
  getUser,
}: {
  authorization: string | null;
  config?: IbkrServerConfig;
  getUser?: Parameters<typeof authorizeIbkrOwnerPure>[0]["getUser"];
}): Promise<AuthorizedIbkrOwner | IbkrAuthFailure> {
  return authorizeIbkrOwnerPure({ authorization, config, getUser });
}
