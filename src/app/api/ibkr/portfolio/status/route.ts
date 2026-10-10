import { NextResponse, type NextRequest } from "next/server";
import { authorizeIbkrOwner } from "../../../../../data/ibkr/server";
import { createIbkrPortfolioService } from "../../../../../data/ibkr/sync";
import { serializeIbkrError } from "../../../../../data/ibkr/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const auth = await authorizeIbkrOwner({ authorization: request.headers.get("authorization") });
  if (auth.status !== 200) {
    if (auth.status === 503) return json({ configured: false, owner: false, snapshot: null, sync: null, error: auth.error }, 503);
    if (auth.status === 403) return json({ configured: true, owner: false, snapshot: null, sync: null, error: auth.error }, 403);
    return json({ error: auth.error }, auth.status);
  }

  try {
    const result = await createIbkrPortfolioService(auth).getStatus();
    return json(result.body, result.status);
  } catch (error) {
    const diagnostic = serializeIbkrError(error);
    return json({ error: "No se pudo leer el estado de IBKR.", errorStage: diagnostic.stage, errorCode: diagnostic.code }, 502);
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}
