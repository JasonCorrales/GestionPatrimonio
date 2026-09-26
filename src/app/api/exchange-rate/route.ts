import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BCCR_API_BASE_URL = "https://apim.bccr.fi.cr/SDDE/api/Bccr.GE.SDDE.Publico.Indicadores.API";
const BCCR_USD_SELL_INDICATOR = "318";
const BCCR_LANGUAGE = "es";
const COSTA_RICA_TIME_ZONE = "America/Costa_Rica";
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const VALUE_FIELDS = ["value", "valor", "Valor", "NUM_VALOR"] as const;
const DATE_FIELDS = ["fecha", "Fecha", "date", "DES_FECHA"] as const;
const ARRAY_FIELDS = ["datos", "data", "value"] as const;

type ExchangeRateResponse = {
  rate: number;
  date: string;
  source: "BCCR";
  indicator: typeof BCCR_USD_SELL_INDICATOR;
  label: string;
};

type IndicatorValue = {
  value: number;
  date?: string;
};

export async function GET() {
  const token = process.env.BCCR_TOKEN;

  if (!token) {
    return errorResponse("BCCR credentials are not configured.", 503);
  }

  const queryDate = getCostaRicaDateParts();
  const requestUrl = buildBccrRequestUrl(queryDate.forQuery);

  try {
    const bccrResponse = await fetch(requestUrl, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!bccrResponse.ok) {
      return errorResponse(`BCCR request failed with status ${bccrResponse.status}.`, 502);
    }

    const payload: unknown = await bccrResponse.json();
    const exchangeRate = normalizeIndicatorValue(payload);

    if (!exchangeRate || !Number.isFinite(exchangeRate.value) || exchangeRate.value <= 0) {
      return errorResponse("BCCR returned an invalid exchange-rate value.", 502);
    }

    const response: ExchangeRateResponse = {
      rate: exchangeRate.value,
      date: formatResponseDate(exchangeRate.date ?? queryDate.iso),
      source: "BCCR",
      indicator: BCCR_USD_SELL_INDICATOR,
      label: "Tipo de cambio venta dólar/colón",
    };

    return NextResponse.json(response, {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return errorResponse(getErrorMessage(error), 502);
  }
}

function buildBccrRequestUrl(date: string) {
  const url = new URL(`${BCCR_API_BASE_URL}/indicadoresEconomicos/${BCCR_USD_SELL_INDICATOR}/series`);

  url.searchParams.set("fechaInicio", date);
  url.searchParams.set("fechaFin", date);
  url.searchParams.set("idioma", BCCR_LANGUAGE);

  return url;
}

function getCostaRicaDateParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COSTA_RICA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to resolve today's Costa Rica date.");
  }

  return {
    forQuery: `${year}/${month}/${day}`,
    iso: `${year}-${month}-${day}`,
  };
}

function normalizeIndicatorValue(payload: unknown): IndicatorValue | undefined {
  const records = collectIndicatorRecords(payload);
  const parsedRecords = records.map(parseIndicatorRecord).filter((record): record is IndicatorValue => Boolean(record));

  return parsedRecords.at(-1);
}

function collectIndicatorRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  for (const field of ARRAY_FIELDS) {
    const value = payload[field];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [payload];
}

function parseIndicatorRecord(record: unknown): IndicatorValue | undefined {
  if (!isRecord(record)) {
    const value = parseNumber(record);
    return value === undefined ? undefined : { value };
  }

  const value = parseNumber(findFirstField(record, VALUE_FIELDS));

  if (value === undefined) {
    return undefined;
  }

  const date = findFirstStringField(record, DATE_FIELDS);

  return { value, date };
}

function findFirstField(record: Record<string, unknown>, fields: readonly string[]) {
  for (const field of fields) {
    if (record[field] !== undefined && record[field] !== null) {
      return record[field];
    }
  }

  return undefined;
}

function findFirstStringField(record: Record<string, unknown>, fields: readonly string[]) {
  const value = findFirstField(record, fields);

  return typeof value === "string" ? value : undefined;
}

function parseNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim().replace(/\s/g, "").replace(",", ".");
  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function formatResponseDate(date: string) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return date.replaceAll("/", "-");
  }

  return parsedDate.toISOString().slice(0, 10);
}

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: NO_STORE_HEADERS,
    },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown BCCR exchange-rate error";
}
