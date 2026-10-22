import PDFDocument from "pdfkit";
import { addServiceDays, addServiceMonths } from "../shared/grazingServices.ts";

const ink = "#1b2b25";
const green = "#315f42";
const muted = "#617269";
const pale = "#f0f5ef";
const rule = "#d9e2da";
const left = 44;
const width = 524;
const usd = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export function grazingJournalEntries(amountCents) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error("Invalid journal amount");
  return [
    { entity: "Deck Family Farm", lines: [
      { account: "Owner's Equity - transfer to Creamy Cow", debitCents: amountCents, creditCents: 0 },
      { account: "Grazing Services Income", debitCents: 0, creditCents: amountCents },
    ] },
    { entity: "Creamy Cow, LLC", lines: [
      { account: "Grazing Services Expense", debitCents: amountCents, creditCents: 0 },
      { account: "Owner's Equity - transfer from Deck Family Farm", debitCents: 0, creditCents: amountCents },
    ] },
  ];
}

function label(doc, value, x, y, w, options = {}) {
  const size = options.size || 9;
  doc.fillColor(options.color || ink).font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
  let shown = String(value);
  if (doc.widthOfString(shown) > w) {
    while (shown.length && doc.widthOfString(`${shown}...`) > w) shown = shown.slice(0, -1);
    shown += "...";
  }
  doc.text(shown, x, y, { width: w, align: options.align || "left", lineBreak: false });
}

function line(doc, y) {
  doc.strokeColor(rule).lineWidth(0.6).moveTo(left, y).lineTo(left + width, y).stroke();
}

function sectionTitle(doc, title, y) {
  label(doc, title, left, y, width, { bold: true, size: 12, color: green });
}

function drawJournal(doc, entry, date, y) {
  doc.roundedRect(left, y, width, 119, 5).fill(pale);
  label(doc, `${entry.entity} | General journal entry | ${date}`, left + 12, y + 10, width - 24,
    { bold: true, size: 10, color: green });
  label(doc, "ACCOUNT", left + 12, y + 30, 310, { bold: true, size: 8, color: muted });
  label(doc, "DEBIT", left + 345, y + 30, 70, { bold: true, size: 8, color: muted, align: "right" });
  label(doc, "CREDIT", left + 435, y + 30, 75, { bold: true, size: 8, color: muted, align: "right" });
  entry.lines.forEach((item, index) => {
    const rowY = y + 48 + index * 19;
    label(doc, item.account, left + 12, rowY, 320, { size: 8.5 });
    label(doc, item.debitCents ? usd(item.debitCents) : "", left + 345, rowY, 70,
      { size: 8.5, align: "right" });
    label(doc, item.creditCents ? usd(item.creditCents) : "", left + 435, rowY, 75,
      { size: 8.5, align: "right" });
  });
  label(doc, "Balanced total", left + 12, y + 95, 320, { bold: true, size: 8.5 });
  const debit = entry.lines.reduce((sum, item) => sum + item.debitCents, 0);
  const credit = entry.lines.reduce((sum, item) => sum + item.creditCents, 0);
  if (debit !== credit) throw new Error(`${entry.entity} journal entry does not balance`);
  label(doc, usd(debit), left + 345, y + 95, 70, { bold: true, size: 8.5, align: "right" });
  label(doc, usd(credit), left + 435, y + 95, 75, { bold: true, size: 8.5, align: "right" });
}

export function monthlyRateSegments(rates, month, throughDate) {
  const start = `${month}-01`;
  const relevant = rates.filter((rate) => rate.effectiveDate <= throughDate)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  const changes = relevant.filter((rate) => rate.effectiveDate > start);
  const opening = relevant.filter((rate) => rate.effectiveDate <= start).at(-1);
  const sequence = [...(opening ? [{ ...opening, start }] : []),
    ...changes.map((rate) => ({ ...rate, start: rate.effectiveDate }))];
  return sequence.map((rate, index) => ({ ...rate,
    end: sequence[index + 1] ? addServiceDays(sequence[index + 1].start, -1) : throughDate }));
}

function drawDetailHeader(doc, month, contractName, continuation = false) {
  label(doc, "DECK FAMILY FARM GRAZING", left, 44, width, { bold: true, size: 8, color: green });
  label(doc, continuation ? "Animal charge detail (continued)" : "Animal charge detail", left, 68, width,
    { bold: true, size: 18 });
  label(doc, `${contractName}  |  ${month}`, left, 96, width, { size: 9, color: muted });
  doc.rect(left, 120, width, 23).fill(pale);
  const headings = ["ANIMAL #", "PHENOTYPE", "TYPE", "SEX", "BORN", "DAYS", "CHARGE"];
  const xs = [left + 6, left + 82, left + 208, left + 269, left + 318, left + 400, left + 448];
  const ws = [72, 122, 58, 46, 79, 42, 72];
  headings.forEach((heading, index) => label(doc, heading, xs[index], 127, ws[index],
    { bold: true, size: 7.5, color: muted, align: index >= 5 ? "right" : "left" }));
  return { xs, ws };
}

function drawAnimalRow(doc, row, y, columns, shaded) {
  if (shaded) doc.rect(left, y - 2, width, 22).fill("#f8faf7");
  const values = [row.tagNumber, row.phenotype || "-", row.type, row.sex,
    row.dateOfBirth || "-", String(row.headDays), usd(row.amountCents)];
  values.forEach((value, index) => label(doc, value, columns.xs[index], y + 2, columns.ws[index],
    { size: 8, align: index >= 5 ? "right" : "left" }));
  line(doc, y + 20);
}

function drawWarnings(doc, issues, month) {
  if (!issues.length) return;
  doc.addPage();
  let y = 126;
  const header = () => {
    label(doc, "DECK FAMILY FARM GRAZING", left, 44, width, { bold: true, size: 8, color: green });
    label(doc, "Records to review", left, 68, width, { bold: true, size: 18 });
    label(doc, `${month} | These warnings did not automatically exclude otherwise eligible grazing days.`,
      left, 96, width, { size: 9, color: muted });
    label(doc, "A current field may be known even when no dated location is recorded for these days.",
      left, 108, width, { size: 8, color: muted });
    doc.rect(left, 120, width, 23).fill(pale);
    [["ANIMAL #", left + 6, 82], ["ISSUE", left + 95, 185], ["DATES", left + 292, 165],
      ["DAYS", left + 467, 45]].forEach(([value, x, w]) => label(doc, value, x, 127, w,
      { bold: true, size: 7.5, color: muted, align: value === "DAYS" ? "right" : "left" }));
  };
  header();
  issues.forEach((issue, index) => {
    if (y + 30 > 700) { doc.addPage(); y = 126; header(); }
    const rowY = y + 23;
    if (index % 2) doc.rect(left, rowY - 2, width, 23).fill("#f8faf7");
    label(doc, issue.tagNumber, left + 6, rowY + 2, 82, { size: 8 });
    label(doc, issue.code === "unknownLocation" ? "No dated location" : issue.code.replace(/([A-Z])/g, " $1"),
      left + 95, rowY + 2, 185, { size: 8 });
    label(doc, issue.firstDate === issue.lastDate ? issue.firstDate : `${issue.firstDate} to ${issue.lastDate}`,
      left + 292, rowY + 2, 165, { size: 8 });
    label(doc, issue.days, left + 467, rowY + 2, 45, { size: 8, align: "right" });
    line(doc, rowY + 21);
    y += 24;
  });
}

export async function renderGrazingReportPdf({ report, contract, rates, issues, generatedAt = new Date() }) {
  if (!contract || contract.id !== "creamy-cow-dairy") throw new Error("Creamy Cow dairy contract is required");
  if (contract.unpricedHeadDays) throw new Error(`${contract.unpricedHeadDays} head-days lack a rate`);
  if (contract.rows.reduce((sum, row) => sum + row.amountCents, 0) !== contract.amountCents)
    throw new Error("Animal charges do not match the contract total");
  if (contract.rows.reduce((sum, row) => sum + row.headDays, 0) !== contract.headDays)
    throw new Error("Animal head-days do not match the contract total");
  const end = addServiceDays(addServiceMonths(`${report.month}-01`, 1), -1);
  if (report.throughDate !== end) throw new Error("A monthly journal report requires a completed month");
  const entries = grazingJournalEntries(contract.amountCents);
  const doc = new PDFDocument({ size: "LETTER", margin: 44, bufferPages: true, autoFirstPage: false,
    info: { Title: `Creamy Cow dairy grazing services - ${report.month}`,
      Author: "Deck Family Farm Grazing", Subject: "Monthly grazing services support and proposed journal entries" } });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => { doc.on("end", resolve); doc.on("error", reject); });
  doc.addPage();
  label(doc, "DECK FAMILY FARM GRAZING", left, 44, width, { bold: true, size: 8, color: green });
  line(doc, 60);
  label(doc, "Monthly grazing services", left, 75, width, { bold: true, size: 22 });
  label(doc, `Creamy Cow, LLC  |  ${report.month}-01 to ${report.throughDate}`,
    left, 109, width, { size: 10, color: muted });
  const statY = 143;
  const stats = [
    ["ANIMALS", String(contract.rows.length)],
    ["HEAD-DAYS", String(contract.headDays)],
    ["GRAZING CHARGE", usd(contract.amountCents)],
  ];
  stats.forEach(([name, value], index) => {
    const x = left + index * 178;
    doc.roundedRect(x, statY, 168, 63, 5).fill(pale);
    label(doc, name, x + 10, statY + 10, 148, { bold: true, size: 8, color: muted });
    label(doc, value, x + 10, statY + 29, 148, { bold: true, size: 16, color: green });
  });
  label(doc, 'Note: Animals currently in "Missing" are excluded from detail, head-days, and charges.',
    left, 211, width, { size: 8, color: muted });
  drawJournal(doc, entries[0], end, 225);
  drawJournal(doc, entries[1], end, 362);
  sectionTitle(doc, "Rate basis", 508);
  const segments = monthlyRateSegments(rates, report.month, report.throughDate);
  let rateY = 534;
  if (!segments.length) label(doc, "No rate applies to this month.", left, rateY, width, { size: 9 });
  for (const segment of segments) {
    if (rateY > 678) {
      doc.addPage();
      sectionTitle(doc, "Rate basis (continued)", 68);
      rateY = 96;
    }
    label(doc, `${segment.start} to ${segment.end}  |  ${usd(segment.rateCents)}/head/day  |  rate effective ${segment.effectiveDate}`,
      left, rateY, width, { size: 9 });
    rateY += 18;
    if (segment.freeUnderMonths != null) {
      if (rateY > 678) {
        doc.addPage();
        sectionTitle(doc, "Rate basis (continued)", 68);
        rateY = 96;
      }
      label(doc, `Under ${segment.freeUnderMonths} months: free ($0/head/day); counted as grazing from the first pasture day.`,
        left + 12, rateY, width - 12, { size: 8.5, color: muted });
      rateY += 18;
    }
    if (segment.seasonStartMonth != null) {
      if (rateY > 678) {
        doc.addPage();
        sectionTitle(doc, "Rate basis (continued)", 68);
        rateY = 96;
      }
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      label(doc, `Seasonal ${months[segment.seasonStartMonth - 1]}-${months[segment.seasonEndMonth - 1]}: over ${segment.ageThresholdMonths} months ${usd(segment.olderRateCents)}/head/day; ${segment.ageThresholdMonths} months or younger ${usd(segment.youngerRateCents)}/head/day`,
        left + 12, rateY, width - 12, { size: 8.5, color: muted });
      rateY += 18;
    }
  }
  if (rateY < 704) label(doc, "Suggested entries for separate entity books. Source: Herdlist contract, animal and movement records.",
    left, Math.max(rateY + 10, 677), width, { size: 8, color: muted });

  doc.addPage();
  let columns = drawDetailHeader(doc, report.month, contract.name);
  let y = 151;
  contract.rows.forEach((row, index) => {
    if (y + 24 > 695) {
      doc.addPage();
      columns = drawDetailHeader(doc, report.month, contract.name, true);
      y = 151;
    }
    drawAnimalRow(doc, row, y, columns, index % 2 === 1);
    y += 23;
  });
  if (y + 34 > 695) {
    doc.addPage();
    columns = drawDetailHeader(doc, report.month, contract.name, true);
    y = 151;
  }
  doc.rect(left, y + 3, width, 29).fill(pale);
  label(doc, `TOTAL  |  ${contract.rows.length} animals`, left + 6, y + 12, 350, { bold: true, size: 9 });
  label(doc, contract.headDays, columns.xs[5], y + 12, columns.ws[5], { bold: true, size: 9, align: "right" });
  label(doc, usd(contract.amountCents), columns.xs[6], y + 12, columns.ws[6],
    { bold: true, size: 9, align: "right" });
  drawWarnings(doc, issues, report.month);

  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index++) {
    doc.switchToPage(index);
    line(doc, 724);
    label(doc, `Generated ${generatedAt.toISOString().slice(0, 19).replace("T", " ")} UTC`,
      left, 730, 310, { size: 7.5, color: muted });
    label(doc, `Page ${index + 1} of ${range.count}  |  GRAZING-${report.month}`, left + 360, 730, 164,
      { size: 7.5, color: muted, align: "right" });
  }
  doc.end();
  await finished;
  return Buffer.concat(chunks);
}
