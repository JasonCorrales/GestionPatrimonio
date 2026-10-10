import test from "node:test";
import assert from "node:assert/strict";

// Node 24's native test runner loads TypeScript files directly.
// @ts-expect-error TS5097: native Node TypeScript import requires the .ts suffix.
import { IBKR_FLEX_GET_STATEMENT_URL, IBKR_FLEX_SEND_REQUEST_URL, IbkrFlexClient, parseFlexStatement } from "../../src/data/ibkr/flex.ts";

const uuid = "11111111-1111-4111-8111-111111111111";

function statementXml(body: string) {
  return `<FlexQueryResponse queryName="Portfolio" type="AF">
  <FlexStatements count="1">
    <FlexStatement accountId="DU123" fromDate="2024-05-31" toDate="2024-05-31" whenGenerated="2024-06-01;12:00:00">
      ${body}
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>`;
}

test("parseFlexStatement normalizes summary rows by account, conid and currency", () => {
  const portfolio = parseFlexStatement(
    statementXml(`
      <EquitySummaryInBase>
        <EquitySummaryByReportDateInBase reportDate="2024-05-31" total="1000.00" cash="125.50" currency="USD" />
      </EquitySummaryInBase>
      <OpenPositions>
        <OpenPosition levelOfDetail="Summary" accountId="DU123" conid="265598" symbol="AAPL" currency="USD" position="3" multiplier="1" markPrice="190.25" positionValue="570.75" costBasisMoney="500.25" costBasisPrice="166.75" fifoPnlUnrealized="70.50" />
        <OpenPosition levelOfDetail="Lot" accountId="DU123" conid="265598" symbol="AAPL" currency="USD" position="1" positionValue="190.25" />
        <OpenPosition levelOfDetail="Summary" accountId="DU123" conid="12345" symbol="SHOP" currency="CAD" position="2" multiplier="1" markPrice="90" />
      </OpenPositions>`),
    { ownerUserId: uuid, selectedAccountId: "DU123" },
  );

  assert.equal(portfolio.userId, uuid);
  assert.equal(portfolio.accountId, "DU123");
  assert.equal(portfolio.reportDate, "2024-05-31");
  assert.equal(portfolio.nav?.currency, "USD");
  assert.equal(portfolio.nav?.amount, "1000.00");
  assert.equal(portfolio.cash?.amount, "125.50");
  assert.equal(portfolio.positions.length, 2);
  assert.deepEqual(portfolio.positions[0], {
    accountId: "DU123",
    conid: "265598",
    symbol: "AAPL",
    currency: "USD",
    quantity: "3",
    multiplier: "1",
    markPrice: "190.25",
    positionValue: "570.75",
    costBasisMoney: "500.25",
    costBasisPrice: "166.75",
    fifoPnlUnrealized: "70.50",
  });
  assert.equal(portfolio.positions[1].positionValue, null);
});

test("parseFlexStatement accepts uppercase SUMMARY rows, ignores uppercase LOT rows, and preserves missing detail as summary", () => {
  const portfolio = parseFlexStatement(
    statementXml(`
      <OpenPositions>
        <OpenPosition levelOfDetail="SUMMARY" accountId="DU123" conid="111" symbol="MSFT" currency="USD" position="4" />
        <OpenPosition levelOfDetail="LOT" accountId="DU123" conid="111" symbol="MSFT" currency="USD" position="1" />
        <OpenPosition accountId="DU123" conid="222" symbol="GOOG" currency="USD" position="2" />
      </OpenPositions>`),
    { ownerUserId: uuid, selectedAccountId: "DU123" },
  );

  assert.equal(portfolio.positions.length, 2);
  assert.equal(portfolio.positions[0].conid, "111");
  assert.equal(portfolio.positions[0].quantity, "4");
  assert.equal(portfolio.positions[1].conid, "222");
  assert.equal(portfolio.positions[1].quantity, "2");
});

test("parseFlexStatement distinguishes valid empty portfolio from missing OpenPositions", () => {
  const empty = parseFlexStatement(
    statementXml(`<OpenPositions></OpenPositions>`),
    { ownerUserId: uuid, selectedAccountId: "DU123" },
  );
  assert.deepEqual(empty.positions, []);

  assert.throws(
    () => parseFlexStatement(statementXml(`<Trades></Trades>`), { ownerUserId: uuid, selectedAccountId: "DU123" }),
    /missing OpenPositions/i,
  );
});

test("parseFlexStatement rejects unsafe XML, ambiguous accounts and malformed reports", () => {
  assert.throws(
    () => parseFlexStatement(`<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><FlexQueryResponse />`, { ownerUserId: uuid }),
    /DTD/i,
  );

  assert.throws(
    () => parseFlexStatement(
      `<FlexQueryResponse><FlexStatements><FlexStatement accountId="DU1" toDate="2024-05-31"><OpenPositions /></FlexStatement><FlexStatement accountId="DU2" toDate="2024-05-31"><OpenPositions /></FlexStatement></FlexStatements></FlexQueryResponse>`,
      { ownerUserId: uuid },
    ),
    /multiple accounts/i,
  );

  assert.throws(
    () => parseFlexStatement(`<FlexQueryResponse><FlexStatements><FlexStatement accountId="DU1"><OpenPositions /></FlexStatement></FlexStatements></FlexQueryResponse>`, { ownerUserId: uuid }),
    /report date/i,
  );
});

test("parseFlexStatement only preserves generated timestamps with explicit offsets", () => {
  assert.equal(
    parseFlexStatement(statementXml(`<OpenPositions />`).replace("2024-06-01;12:00:00", "20240601;120000"), { ownerUserId: uuid }).generatedAt,
    null,
  );
  assert.equal(
    parseFlexStatement(statementXml(`<OpenPositions />`).replace("2024-06-01;12:00:00", "2024-06-01;12:00:00"), { ownerUserId: uuid }).generatedAt,
    null,
  );
  assert.equal(
    parseFlexStatement(statementXml(`<OpenPositions />`).replace("2024-06-01;12:00:00", "20240601;120000-0500"), { ownerUserId: uuid }).generatedAt,
    "2024-06-01T12:00:00-05:00",
  );
  assert.equal(
    parseFlexStatement(statementXml(`<OpenPositions />`).replace("2024-06-01;12:00:00", "2024-06-01T12:00:00-05:00"), { ownerUserId: uuid }).generatedAt,
    "2024-06-01T12:00:00-05:00",
  );
  assert.equal(
    parseFlexStatement(statementXml(`<OpenPositions />`).replace("2024-06-01;12:00:00", "2024-06-01T12:00:00+24:00"), { ownerUserId: uuid }).generatedAt,
    null,
  );
});

test("parseFlexStatement validates real dates and strict SQL-safe decimals", () => {
  assert.equal(parseFlexStatement(
    `<FlexQueryResponse><FlexStatements><FlexStatement accountId="DU1" toDate="2024-02-29"><EquitySummaryInBase><EquitySummaryByReportDateInBase total="123456789012345678.1234567890" cash="0.0000000001" currency="USD" /></EquitySummaryInBase><OpenPositions><OpenPosition levelOfDetail="Summary" accountId="DU1" conid="1" symbol="A" currency="USD" position=".5" markPrice="10" /></OpenPositions></FlexStatement></FlexStatements></FlexQueryResponse>`,
    { ownerUserId: uuid },
  ).positions[0].quantity, ".5");

  assert.throws(
    () => parseFlexStatement(`<FlexQueryResponse><FlexStatements><FlexStatement accountId="DU1" toDate="2024-02-30"><OpenPositions /></FlexStatement></FlexStatements></FlexQueryResponse>`, { ownerUserId: uuid }),
    /report date/i,
  );
  assert.throws(
    () => parseFlexStatement(statementXml(`<OpenPositions><OpenPosition levelOfDetail="Summary" accountId="DU123" conid="1" currency="USD" position="NaN" /></OpenPositions>`), { ownerUserId: uuid }),
    /number/i,
  );
  assert.throws(
    () => parseFlexStatement(statementXml(`<EquitySummaryInBase><EquitySummaryByReportDateInBase total="1e3" currency="USD" /></EquitySummaryInBase><OpenPositions />`), { ownerUserId: uuid }),
    /number/i,
  );
});

test("parseFlexStatement rejects repeated account statements instead of picking the first", () => {
  assert.throws(
    () => parseFlexStatement(
      `<FlexQueryResponse><FlexStatements><FlexStatement accountId="DU1" toDate="2024-05-31"><OpenPositions /></FlexStatement><FlexStatement accountId="DU1" toDate="2024-06-01"><OpenPositions /></FlexStatement></FlexStatements></FlexQueryResponse>`,
      { ownerUserId: uuid, selectedAccountId: "DU1" },
    ),
    /multiple FlexStatement/i,
  );
});

test("IbkrFlexClient streams bounded XML, cancels oversized bodies before consuming tail, and handles multi-byte chunks", async () => {
  let pulls = 0;
  let cancelled = false;
  const encoder = new TextEncoder();
  const client = new IbkrFlexClient({
    token: "secret-token",
    queryId: "123456",
    maxResponseBytes: 10,
    fetch: async () => ({
      ok: true,
      headers: new Headers(),
      body: {
        getReader() {
          return {
            async read() {
              pulls += 1;
              if (pulls === 1) {
                return { done: false, value: encoder.encode("éééééa") };
              }
              return { done: false, value: encoder.encode("TAIL-SHOULD-NOT-BE-CONSUMED") };
            },
            async cancel() {
              cancelled = true;
            },
          };
        },
      },
    }) as unknown as Response,
  });

  await assert.rejects(() => client.sendRequest(), /exceeds byte limit/i);
  assert.equal(cancelled, true);
  assert.equal(pulls, 1);
});

test("IbkrFlexClient rejects oversized advertised Content-Length before reading and sanitizes aborts", async () => {
  let pulled = false;
  const oversized = new IbkrFlexClient({
    token: "secret-token",
    queryId: "123456",
    maxResponseBytes: 5,
    fetch: async () => ({
      ok: true,
      headers: new Headers({ "Content-Length": "6" }),
      body: {
        getReader() {
          return {
            async read() {
              pulled = true;
              return { done: false, value: new TextEncoder().encode("secret-token") };
            },
            async cancel() {},
          };
        },
      },
    }) as unknown as Response,
  });

  await assert.rejects(() => oversized.sendRequest(), /exceeds byte limit/i);
  assert.equal(pulled, false);

  const aborted = new IbkrFlexClient({
    token: "super-secret-token-123456",
    queryId: "123456",
    timeoutMs: 1,
    fetch: async () => new Response(
      new ReadableStream<Uint8Array>({
        start() {
          // Keep stream open until the client timeout aborts it.
        },
      }),
    ),
  });

  await assert.rejects(
    () => aborted.sendRequest(),
    (error) => error instanceof Error && /timed out|aborted/i.test(error.message) && !error.message.includes("super-secret-token"),
  );
});

test("IbkrFlexClient uses fixed endpoints, handles pending 1019 and sanitizes errors", async () => {
  const calls: string[] = [];
  const client = new IbkrFlexClient({
    token: "secret-token",
    queryId: "123456",
    fetch: async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.startsWith(IBKR_FLEX_SEND_REQUEST_URL)) {
        return new Response(`<FlexStatementResponse><Status>Success</Status><ReferenceCode>ABC123</ReferenceCode><Url>https://evil.example/report</Url></FlexStatementResponse>`);
      }
      if (url.startsWith(IBKR_FLEX_GET_STATEMENT_URL)) {
        return new Response(`<FlexStatementResponse><Status>Fail</Status><ErrorCode>1019</ErrorCode><ErrorMessage>Statement generation in progress for token secret-token</ErrorMessage></FlexStatementResponse>`);
      }
      throw new Error("unexpected url");
    },
  });

  const request = await client.sendRequest();
  assert.deepEqual(request, { state: "requested", referenceCode: "ABC123" });
  const statement = await client.getStatement(request.referenceCode);
  assert.equal(statement.state, "pending");
  assert.equal(statement.code, "1019");
  assert.match(statement.message, /pending/i);
  assert.doesNotMatch(statement.message, /secret-token/);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].startsWith(IBKR_FLEX_SEND_REQUEST_URL));
  assert.ok(calls[1].startsWith(IBKR_FLEX_GET_STATEMENT_URL));
  assert.ok(calls.every((url) => !url.startsWith("https://evil.example")));
});
