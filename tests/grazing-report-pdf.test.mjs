import test from "node:test";
import assert from "node:assert/strict";
import { grazingJournalEntries, monthlyRateSegments, renderGrazingReportPdf } from "../scripts/grazingReportPdf.mjs";
import { PDFDocument } from "pdf-lib";
import { combineGrazingRangePdfs, monthsEndingAt } from "../scripts/grazingReportRange.mjs";

test("both entity journal entries balance and use the requested income, expense, and equity accounts", () => {
  const entries = grazingJournalEntries(12345);
  assert.deepEqual(entries.map(({ entity }) => entity), ["Deck Family Farm", "Creamy Cow, LLC"]);
  assert.deepEqual(entries[0].lines.map(({ account, debitCents, creditCents }) =>
    [account, debitCents, creditCents]), [
    ["Owner's Equity - transfer to Creamy Cow", 12345, 0],
    ["Grazing Services Income", 0, 12345],
  ]);
  assert.deepEqual(entries[1].lines.map(({ account, debitCents, creditCents }) =>
    [account, debitCents, creditCents]), [
    ["Grazing Services Expense", 12345, 0],
    ["Owner's Equity - transfer from Deck Family Farm", 0, 12345],
  ]);
  for (const entry of entries) {
    assert.equal(entry.lines.reduce((sum, line) => sum + line.debitCents, 0), 12345);
    assert.equal(entry.lines.reduce((sum, line) => sum + line.creditCents, 0), 12345);
  }
});

test("PDF rate basis splits a month on the effective day", () => {
  assert.deepEqual(monthlyRateSegments([
    { effectiveDate: "2015-01-01", rateCents: 50 },
    { effectiveDate: "2026-09-20", rateCents: 75 },
  ], "2026-09", "2026-09-30").map(({ start, end, rateCents }) => ({ start, end, rateCents })), [
    { start: "2026-09-01", end: "2026-09-19", rateCents: 50 },
    { start: "2026-09-20", end: "2026-09-30", rateCents: 75 },
  ]);
  const [seasonal] = monthlyRateSegments([{
    effectiveDate: "2026-10-20", rateCents: 100,
    seasonStartMonth: 12, seasonEndMonth: 3, ageThresholdMonths: 12,
    olderRateCents: 325, youngerRateCents: 150, freeUnderMonths: 6,
  }], "2026-12", "2026-12-31");
  assert.equal(seasonal.olderRateCents, 325);
  assert.equal(seasonal.youngerRateCents, 150);
  assert.equal(seasonal.freeUnderMonths, 6);
});

test("n months ends at the selected completed month", () => {
  assert.deepEqual(monthsEndingAt("2026-09", 9), [
    "2026-01", "2026-02", "2026-03", "2026-04", "2026-05",
    "2026-06", "2026-07", "2026-08", "2026-09",
  ]);
  assert.throws(() => monthsEndingAt("2026-09", 0), /n value/);
});

test("PDF renders the journal page and animal support, and rejects incomplete charges", async () => {
  const contract = {
    id: "creamy-cow-dairy", name: "Creamy Cow dairy grazing", ownerId: "creamy-cow-llc", kind: "dairy",
    headDays: 30, amountCents: 1500, unpricedHeadDays: 0,
    rows: [{ tagNumber: "COW-42", phenotype: "Holstein", type: "dairy", sex: "female",
      dateOfBirth: "2020-01-01", headDays: 30, amountCents: 1500 }],
  };
  const args = {
    report: { month: "2026-09", throughDate: "2026-09-30" }, contract,
    rates: [{ effectiveDate: "2015-01-01", rateCents: 50 }], issues: [],
    generatedAt: new Date("2026-10-01T12:00:00Z"),
  };
  const pdf = await renderGrazingReportPdf(args);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 3000);
  const seasonalPdf = await renderGrazingReportPdf({ ...args, rates: [{ ...args.rates[0],
    seasonStartMonth: 12, seasonEndMonth: 3, ageThresholdMonths: 12,
    olderRateCents: 325, youngerRateCents: 150, freeUnderMonths: 6 }] });
  assert.equal(seasonalPdf.subarray(0, 5).toString(), "%PDF-");
  await assert.rejects(renderGrazingReportPdf({ ...args,
    contract: { ...contract, unpricedHeadDays: 1 } }), /lack a rate/);
  await assert.rejects(renderGrazingReportPdf({ ...args,
    report: { month: "2026-09", throughDate: "2026-09-29" } }), /completed month/);
});

test("combined report starts with a summary page and retains each month's PDF pages", async () => {
  const items = [];
  for (const month of ["2026-08", "2026-09"]) {
    const throughDate = month === "2026-08" ? "2026-08-31" : "2026-09-30";
    const contract = { id: "creamy-cow-dairy", name: "Creamy Cow dairy grazing",
      headDays: 3, amountCents: 150, unpricedHeadDays: 0,
      rows: [{ tagNumber: "COW-42", phenotype: "Holstein", type: "dairy", sex: "female",
        dateOfBirth: "2020-01-01", headDays: 3, amountCents: 150 }] };
    const pdf = await renderGrazingReportPdf({ report: { month, throughDate }, contract,
      rates: [{ effectiveDate: "2015-01-01", rateCents: 50 }], issues: [] });
    items.push({ month, contract, issues: [], pdf });
  }
  const combined = await PDFDocument.load(await combineGrazingRangePdfs(items));
  const individualPages = await Promise.all(items.map(async (item) =>
    (await PDFDocument.load(item.pdf)).getPageCount()));
  assert.equal(combined.getPageCount(), 1 + individualPages.reduce((sum, count) => sum + count, 0));
});
