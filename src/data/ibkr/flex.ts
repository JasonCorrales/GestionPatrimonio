import { XMLParser } from "fast-xml-parser";
import type { IbkrPortfolioPosition, IbkrPortfolioSnapshot } from "../../domain/ibkrPortfolio";

export const IBKR_FLEX_SEND_REQUEST_URL = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/SendRequest";
export const IBKR_FLEX_GET_STATEMENT_URL = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement";

const DEFAULT_MAX_RESPONSE_BYTES = 2_000_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const DTD_OR_ENTITY_PATTERN = /<!\s*(doctype|entity)\b/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COMPACT_DATE_PATTERN = /^\d{8}$/;
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T;](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})?$/;
const COMPACT_DATE_TIME_PATTERN = /^(\d{4})(\d{2})(\d{2});(\d{2})(\d{2})(\d{2})(Z|[+-]\d{2}:?\d{2})?$/;
const DECIMAL_PATTERN = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const MAX_NUMERIC_DIGITS = 28;
const MAX_NUMERIC_SCALE = 10;

type FlexClientFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type XmlNode = Record<string, unknown>;

export type FlexClientOptions = {
  token: string;
  queryId: string;
  fetch?: FlexClientFetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
};

export type FlexRequestResult = {
  state: "requested";
  referenceCode: string;
};

export type FlexStatementResult =
  | { state: "ready"; xml: string }
  | { state: "pending"; code: "1019"; message: string }
  | { state: "failed"; code: string | null; message: string };

export class IbkrFlexClient {
  private readonly fetchImpl: FlexClientFetch;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;
  private readonly options: FlexClientOptions;

  constructor(options: FlexClientOptions) {
    this.options = options;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  }

  async sendRequest(): Promise<FlexRequestResult> {
    const xml = await this.fetchText(IBKR_FLEX_SEND_REQUEST_URL, {
      t: this.options.token,
      q: this.options.queryId,
      v: "3",
    });
    const response = asXmlNode(parseXmlObject(xml).FlexStatementResponse);
    const status = getText(response?.Status);
    const referenceCode = getText(response?.ReferenceCode);

    if (status !== "Success" || !referenceCode) {
      throw new Error(sanitizeExternalMessage(getText(response?.ErrorMessage) ?? "IBKR Flex request failed"));
    }

    return { state: "requested", referenceCode };
  }

  async getStatement(referenceCode: string): Promise<FlexStatementResult> {
    const xml = await this.fetchText(IBKR_FLEX_GET_STATEMENT_URL, {
      t: this.options.token,
      q: referenceCode,
      v: "3",
    });

    if (xml.includes("<FlexQueryResponse")) {
      return { state: "ready", xml };
    }

    const response = asXmlNode(parseXmlObject(xml).FlexStatementResponse);
    const code = getText(response?.ErrorCode);
    const message = sanitizeExternalMessage(getText(response?.ErrorMessage) ?? "IBKR Flex statement is not ready");

    if (code === "1019") {
      return { state: "pending", code: "1019", message: `IBKR report pending (1019): ${message}` };
    }

    return { state: "failed", code, message };
  }

  private async fetchText(baseUrl: string, params: Record<string, string>): Promise<string> {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { method: "GET", signal: controller.signal });
      if (!response.ok) {
        throw new Error(`IBKR Flex HTTP ${response.status}`);
      }
      const text = await boundedResponseText(response, this.maxResponseBytes, controller.signal);
      ensureSafeXml(text);
      return text;
    } catch (error) {
      throw new Error(sanitizeExternalMessage(error instanceof Error ? error.message : "IBKR Flex request failed"));
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function parseFlexStatement(
  xml: string,
  options: { ownerUserId: string; selectedAccountId?: string },
): IbkrPortfolioSnapshot {
  ensureSafeXml(xml);
  if (new TextEncoder().encode(xml).byteLength > DEFAULT_MAX_RESPONSE_BYTES) {
    throw new Error("IBKR Flex response exceeds byte limit");
  }

  const root = asXmlNode(parseXmlObject(xml).FlexQueryResponse);
  const statementsNode = asXmlNode(root?.FlexStatements);
  const statements = toArray(statementsNode?.FlexStatement);

  if (statements.length === 0) {
    throw new Error("IBKR Flex response is missing FlexStatement");
  }

  const selectedStatements = (options.selectedAccountId
    ? statements.filter((statement) => getText(asXmlNode(statement)?.accountId) === options.selectedAccountId)
    : statements
  ).map(asXmlNode).filter(isPresent);
  const accountIds = unique(selectedStatements.map((statement) => getText(statement.accountId)).filter(isPresent));

  if (selectedStatements.length === 0) {
    throw new Error("IBKR Flex response does not contain the selected account");
  }
  if (!options.selectedAccountId && accountIds.length > 1) {
    throw new Error("IBKR Flex response contains multiple accounts; select one account explicitly");
  }
  if (accountIds.length !== 1) {
    throw new Error("IBKR Flex response is missing account identity");
  }
  if (selectedStatements.length !== 1) {
    throw new Error("IBKR Flex response contains multiple FlexStatement entries; this import expects exactly one statement");
  }

  const statement = selectedStatements[0];
  const reportDate = getReportDate(statement);
  if (statement.OpenPositions === undefined) {
    throw new Error("IBKR Flex response is missing OpenPositions section");
  }
  const openPositions = asXmlNode(statement.OpenPositions);

  const positions = toArray(openPositions?.OpenPosition)
    .map(asXmlNode)
    .filter(isPresent)
    .filter((row) => isSummaryLevelOfDetail(row.levelOfDetail))
    .map((row): IbkrPortfolioPosition => ({
      accountId: requiredText(row.accountId ?? accountIds[0], "position account"),
      conid: requiredText(row.conid, "position conid"),
      symbol: nullableText(row.symbol),
      currency: requiredText(row.currency, "position currency"),
      quantity: nullableDecimal(row.position ?? row.quantity, "position quantity"),
      multiplier: nullableDecimal(row.multiplier, "position multiplier"),
      markPrice: nullableDecimal(row.markPrice, "position mark price"),
      positionValue: nullableDecimal(row.positionValue, "position value"),
      costBasisMoney: nullableDecimal(row.costBasisMoney, "position cost basis money"),
      costBasisPrice: nullableDecimal(row.costBasisPrice, "position cost basis price"),
      fifoPnlUnrealized: nullableDecimal(row.fifoPnlUnrealized, "position unrealized P/L"),
    }));

  return {
    userId: options.ownerUserId,
    accountId: accountIds[0],
    reportDate,
    generatedAt: parseGeneratedAt(getText(statement.whenGenerated)),
    nav: findMoney(statement, ["total", "netAssetValue", "nav"]),
    cash: findMoney(statement, ["cash", "totalCash"]),
    positions,
  };
}

async function boundedResponseText(response: Response, maxBytes: number, signal: AbortSignal) {
  const advertisedLength = response.headers.get("Content-Length");
  if (advertisedLength !== null) {
    const parsedLength = Number(advertisedLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new Error("IBKR Flex response exceeds byte limit");
    }
  }

  if (!response.body) {
    throw new Error("IBKR Flex response body is missing");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;
  let finished = false;

  const abortPromise = new Promise<never>((_, reject) => {
    signal.addEventListener(
      "abort",
      () => reject(new Error("IBKR Flex request timed out or was aborted")),
      { once: true },
    );
  });

  try {
    while (true) {
      if (signal.aborted) {
        throw new Error("IBKR Flex request timed out or was aborted");
      }

      const result = await Promise.race([reader.read(), abortPromise]);
      if (result.done) {
        finished = true;
        break;
      }

      totalBytes += result.value.byteLength;
      if (totalBytes > maxBytes) {
        throw new Error("IBKR Flex response exceeds byte limit");
      }

      chunks.push(decoder.decode(result.value, { stream: true }));
    }

    chunks.push(decoder.decode());
    return chunks.join("");
  } finally {
    if (!finished) {
      await reader.cancel().catch(() => undefined);
    }
  }
}

function ensureSafeXml(xml: string) {
  if (DTD_OR_ENTITY_PATTERN.test(xml)) {
    throw new Error("IBKR Flex XML with DTD or entities is not allowed");
  }
}

function parseXmlObject(xml: string): XmlNode {
  return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", parseTagValue: false, parseAttributeValue: false }).parse(xml) as XmlNode;
}

function getReportDate(statement: XmlNode) {
  const date = normalizeReportDate(getText(statement.toDate ?? statement.reportDate ?? statement.fromDate));
  if (!date) {
    throw new Error("IBKR Flex statement is missing a valid report date");
  }
  return date;
}

function normalizeReportDate(value: string | null) {
  if (!value) return null;
  const normalized = COMPACT_DATE_PATTERN.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : value;
  if (!DATE_PATTERN.test(normalized)) return null;
  const [yearText, monthText, dayText] = normalized.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return normalized;
}

function findMoney(statement: XmlNode, fields: string[]) {
  const equitySummary = asXmlNode(statement.EquitySummaryInBase);
  const rows = [
    ...toArray(equitySummary?.EquitySummaryByReportDateInBase).map(asXmlNode).filter(isPresent),
    ...toArray(statement.EquitySummaryByReportDateInBase).map(asXmlNode).filter(isPresent),
    statement,
  ];

  for (const row of rows) {
    const currency = getText(row.currency);
    for (const field of fields) {
      const amount = nullableDecimal(row[field], field);
      if (amount && currency) {
        return { amount, currency };
      }
    }
  }
  return null;
}

function parseGeneratedAt(value: string | null) {
  if (!value) return null;
  const compact = COMPACT_DATE_TIME_PATTERN.exec(value);
  if (compact) {
    const [, year, month, day, hour, minute, second, rawOffset] = compact;
    if (!rawOffset) return null;
    const offset = normalizeOffset(rawOffset);
    return validDateTime(year, month, day, hour, minute, second, offset) ? `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}` : null;
  }

  const expanded = DATE_TIME_PATTERN.exec(value);
  if (!expanded) return null;
  const [, year, month, day, hour, minute, second, offset = ""] = expanded;
  if (!offset) return null;
  return validDateTime(year, month, day, hour, minute, second, offset) ? value.replace(";", "T") : null;
}

function normalizeOffset(offset: string) {
  if (offset === "Z" || offset.includes(":")) return offset;
  return `${offset.slice(0, 3)}:${offset.slice(3)}`;
}

function validDateTime(yearText: string, monthText: string, dayText: string, hourText: string, minuteText: string, secondText: string, offset: string) {
  const date = normalizeReportDate(`${yearText}-${monthText}-${dayText}`);
  if (!date) return false;
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return false;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return false;
  if (!Number.isInteger(second) || second < 0 || second > 59) return false;
  if (!offset || offset === "Z") return true;
  const sign = offset[0];
  const offsetHour = Number(offset.slice(1, 3));
  const offsetMinute = Number(offset.slice(4, 6));
  return ["+", "-"].includes(sign)
    && Number.isInteger(offsetHour) && offsetHour >= 0 && offsetHour <= 23
    && Number.isInteger(offsetMinute) && offsetMinute >= 0 && offsetMinute <= 59;
}

function sanitizeExternalMessage(message: string) {
  return message.replace(/[A-Za-z0-9_-]{12,}/g, "[redacted]").slice(0, 300);
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function asXmlNode(value: unknown): XmlNode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as XmlNode;
}

function getText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return String(value).trim() || null;
}

function isSummaryLevelOfDetail(value: unknown) {
  return (getText(value) ?? "Summary").toLowerCase() === "summary";
}

function nullableText(value: unknown): string | null {
  return getText(value);
}

function nullableDecimal(value: unknown, field: string): string | null {
  const text = getText(value);
  if (!text) return null;
  if (!DECIMAL_PATTERN.test(text)) {
    throw new Error(`IBKR Flex response contains invalid number for ${field}`);
  }
  const unsigned = text.replace(/^[-+]/, "");
  const [integerPart, fractionalPart = ""] = unsigned.split(".");
  const integerDigits = integerPart.replace(/^0+/, "").length;
  const totalDigits = integerDigits + fractionalPart.length;
  if (fractionalPart.length > MAX_NUMERIC_SCALE || totalDigits > MAX_NUMERIC_DIGITS) {
    throw new Error(`IBKR Flex response contains number outside SQL numeric bounds for ${field}`);
  }
  return text;
}

function requiredText(value: unknown, field: string) {
  const text = getText(value);
  if (!text) throw new Error(`IBKR Flex response is missing ${field}`);
  return text;
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
