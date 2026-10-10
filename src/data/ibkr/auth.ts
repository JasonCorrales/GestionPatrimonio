import { createClient } from "@supabase/supabase-js";

export type IbkrServerConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  ibkrOwnerUserId?: string;
  ibkrFlexToken?: string;
  ibkrFlexQueryId?: string;
};

type AuthGetUser = (token: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;

export type AuthorizedIbkrOwner = {
  status: 200;
  ownerUserId: string;
  accessToken: string;
  config: Required<IbkrServerConfig>;
};

export type IbkrAuthFailure = {
  status: 401 | 403 | 503;
  error: string;
};

export type SafeIbkrStatusInput = {
  configured: boolean;
  owner: boolean;
  snapshot: SafeSnapshotInput | null;
  job: SafeJobInput | null;
};

type SafeSnapshotInput = {
  accountId: string;
  reportDate: string;
  generatedAt: string | null;
  nav: { amount: string; currency: string } | null;
  cash: { amount: string; currency: string } | null;
  syncedAt: string;
  positions: Array<{
    symbol: string | null;
    currency: string;
    quantity: string | null;
    markPrice: string | null;
    positionValue: string | null;
    costBasisMoney: string | null;
    costBasisPrice: string | null;
    fifoPnlUnrealized: string | null;
  }>;
};

type SafeJobInput = {
  id: string;
  userId?: string;
  state: string;
  referenceCode?: string | null;
  lastExternalCode?: string | null;
  sanitizedMessage?: string | null;
  attempts: number;
  nextAttemptAfter: string | null;
  cooldownUntil: string | null;
  createdAt?: string;
  updatedAt: string;
};

export function getIbkrServerConfigFromEnv(env: NodeJS.ProcessEnv): IbkrServerConfig {
  return {
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    ibkrOwnerUserId: env.IBKR_OWNER_USER_ID,
    ibkrFlexToken: env.IBKR_FLEX_TOKEN,
    ibkrFlexQueryId: env.IBKR_FLEX_QUERY_ID,
  };
}

export async function authorizeIbkrOwnerPure({
  authorization,
  config,
  getUser,
}: {
  authorization: string | null;
  config: IbkrServerConfig;
  getUser?: AuthGetUser;
}): Promise<AuthorizedIbkrOwner | IbkrAuthFailure> {
  const accessToken = getBearerToken(authorization);
  if (!accessToken) {
    return { status: 401, error: "Se requiere una sesión válida." };
  }

  if (!isCompleteConfig(config) || !isUuid(config.ibkrOwnerUserId)) {
    return { status: 503, error: "La integración IBKR no está configurada." };
  }

  const validateUser = getUser ?? buildSupabaseGetUser(config);
  const { data, error } = await validateUser(accessToken);
  if (error || !data.user) {
    return { status: 401, error: "No se pudo validar la sesión actual." };
  }

  if (data.user.id !== config.ibkrOwnerUserId) {
    return { status: 403, error: "Esta cuenta no tiene acceso a Inversiones USA." };
  }

  return {
    status: 200,
    accessToken,
    ownerUserId: config.ibkrOwnerUserId,
    config,
  };
}

export function toSafePortfolioStatus(input: SafeIbkrStatusInput) {
  return {
    configured: input.configured,
    owner: input.owner,
    snapshot: input.snapshot ? {
      accountId: input.snapshot.accountId,
      reportDate: input.snapshot.reportDate,
      generatedAt: input.snapshot.generatedAt,
      syncedAt: input.snapshot.syncedAt,
      nav: input.snapshot.nav,
      cash: input.snapshot.cash,
      positions: input.snapshot.positions.map((position) => ({
        symbol: position.symbol,
        currency: position.currency,
        quantity: position.quantity,
        markPrice: position.markPrice,
        positionValue: position.positionValue,
        costBasisMoney: position.costBasisMoney,
        costBasisPrice: position.costBasisPrice,
        fifoPnlUnrealized: position.fifoPnlUnrealized,
      })),
    } : null,
    sync: input.job ? {
      jobId: input.job.id,
      state: input.job.state,
      attempts: input.job.attempts,
      nextAttemptAt: input.job.nextAttemptAfter,
      cooldownUntil: input.job.cooldownUntil,
      updatedAt: input.job.updatedAt,
      message: input.job.sanitizedMessage ?? null,
    } : null,
  };
}

function buildSupabaseGetUser(config: Required<IbkrServerConfig>): AuthGetUser {
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return (token) => client.auth.getUser(token);
}

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) return undefined;
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token;
}

function isCompleteConfig(config: IbkrServerConfig): config is Required<IbkrServerConfig> {
  return Boolean(
    config.supabaseUrl
    && config.supabaseAnonKey
    && config.supabaseServiceRoleKey
    && config.ibkrOwnerUserId
    && config.ibkrFlexToken
    && config.ibkrFlexQueryId,
  );
}

function isUuid(value: string | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}
