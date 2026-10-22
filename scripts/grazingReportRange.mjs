import PDFDocument from "pdfkit";
import { PDFDocument as MergeDocument } from "pdf-lib";
import { addServiceDays, addServiceMonths, isServiceMonth } from "../shared/grazingServices.ts";

const money = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const left = 44;
const width = 524;
const green = "#315f42";
const ink = "#1b2b25";
const muted = "#617269";
const pale = "#f0f5ef";

export function monthsEndingAt(lastMonth, count) {
  if (!isServiceMonth(lastMonth) || !Number.isInteger(count) || count < 1 || count > 36)
    throw new Error("Choose a valid ending month and an n value from 1 to 36");
  return Array.from({ length: count }, (_, index) =>
    addServiceMonths(`${lastMonth}-01`, index - count + 1).slice(0, 7));
}

function text(doc, value, x, y, w, { bold = false, size = 9, align = "left", color = ink } = {}) {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(color);
  let shown = String(value);
  if (doc.widthOfString(shown) > w) {
    while (shown.length && doc.widthOfString(`${shown}...`) > w) shown = shown.slice(0, -1);
    shown += "...";
  }
  doc.text(shown, x, y, { width: w, align, lineBreak: false });
}

function summaryHeader(doc, first, last, continuation) {
  text(doc, "DECK FAMILY FARM GRAZING", left, 44, width, { bold: true, size: 8, color: green });
  text(doc, continuation ? "Multi-month charge summary (continued)" : "Multi-month grazing charges",
    left, 70, width, { bold: true, size: continuation ? 17 : 21 });
  const from = `${first}-01`;
  const through = addServiceDays(addServiceMonths(`${last}-01`, 1), -1);
  text(doc, `Creamy Cow, LLC  |  ${from} to ${through}`, left, 103, width,
    { size: 10, color: muted });
  text(doc, "Each following monthly section contains the two proposed GJEs and its animal detail.",
    left, 121, width, { size: 8.5, color: muted });
  text(doc, 'Note: Animals currently in "Missing" are excluded from every month shown.',
    left, 134, width, { size: 8, color: muted });
  doc.rect(left, 146, width, 26).fill(pale);
  const cols = [
    ["MONTH", left + 8, 113, "left"],
    ["ANIMALS", left + 126, 70, "right"],
    ["HEAD-DAYS", left + 210, 84, "right"],
    ["CHARGE", left + 317, 100, "right"],
    ["WARNINGS", left + 435, 80, "right"],
  ];
  cols.forEach(([value, x, w, align]) => text(doc, value, x, 155, w,
    { bold: true, size: 8, color: muted, align }));
}

export async function renderGrazingRangeSummaryPdf(items) {
  if (items.length < 2) throw new Error("A multi-month summary needs at least two months");
  const first = items[0].month;
  const last = items.at(-1).month;
  const doc = new PDFDocument({ size: "LETTER", margin: 44, bufferPages: true, autoFirstPage: false,
    info: { Title: `Creamy Cow dairy grazing summary - ${first} to ${last}`,
      Author: "Deck Family Farm Grazing", Subject: "Monthly grazing charges and supporting journal reports" } });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => { doc.on("end", resolve); doc.on("error", reject); });
  doc.addPage();
  summaryHeader(doc, first, last, false);
  let y = 181;
  items.forEach((item, index) => {
    if (y + 33 > 684) {
      doc.addPage();
      summaryHeader(doc, first, last, true);
      y = 181;
    }
    if (index % 2) doc.rect(left, y - 2, width, 25).fill("#f8faf7");
    const row = [item.month, String(item.contract.rows.length), String(item.contract.headDays),
      money(item.contract.amountCents), String(item.issues.length)];
    const cols = [[left + 8, 113, "left"], [left + 126, 70, "right"],
      [left + 210, 84, "right"], [left + 317, 100, "right"], [left + 435, 80, "right"]];
    row.forEach((value, column) => text(doc, value, cols[column][0], y + 5, cols[column][1],
      { size: 9, align: cols[column][2] }));
    doc.strokeColor("#d9e2da").lineWidth(0.5).moveTo(left, y + 24).lineTo(left + width, y + 24).stroke();
    y += 27;
  });
  if (y + 75 > 700) { doc.addPage(); summaryHeader(doc, first, last, true); y = 181; }
  doc.rect(left, y + 2, width, 34).fill(pale);
  text(doc, "TOTAL", left + 8, y + 12, 113, { bold: true, size: 9, color: green });
  text(doc, "-", left + 126, y + 12, 70, { bold: true, size: 9, align: "right", color: green });
  text(doc, items.reduce((sum, item) => sum + item.contract.headDays, 0), left + 210, y + 12, 84,
    { bold: true, size: 9, align: "right", color: green });
  text(doc, money(items.reduce((sum, item) => sum + item.contract.amountCents, 0)), left + 317, y + 12, 100,
    { bold: true, size: 9, align: "right", color: green });
  text(doc, items.reduce((sum, item) => sum + item.issues.length, 0), left + 435, y + 12, 80,
    { bold: true, size: 9, align: "right", color: green });
  text(doc, "Animal counts are shown by month; the total leaves animals blank because one animal can appear in several months.",
    left, y + 48, width, { size: 8, color: muted });

  const pages = doc.bufferedPageRange();
  for (let index = 0; index < pages.count; index++) {
    doc.switchToPage(index);
    doc.strokeColor("#d9e2da").lineWidth(0.6).moveTo(left, 724).lineTo(left + width, 724).stroke();
    text(doc, `GRAZING-${first}-TO-${last}`, left, 730, 315, { size: 7.5, color: muted });
    text(doc, `Summary page ${index + 1} of ${pages.count}`, left + 360, 730, 164,
      { size: 7.5, color: muted, align: "right" });
  }
  doc.end();
  await finished;
  return Buffer.concat(chunks);
}

export async function combineGrazingRangePdfs(items) {
  const summary = await renderGrazingRangeSummaryPdf(items);
  const combined = await MergeDocument.create();
  for (const pdf of [summary, ...items.map((item) => item.pdf)]) {
    const source = await MergeDocument.load(pdf);
    const pages = await combined.copyPages(source, source.getPageIndices());
    pages.forEach((page) => combined.addPage(page));
  }
  combined.setTitle(`Creamy Cow dairy grazing services - ${items[0].month} to ${items.at(-1).month}`);
  combined.setAuthor("Deck Family Farm Grazing");
  combined.setSubject("Monthly charge summary, journal entries, and animal detail");
  return Buffer.from(await combined.save());
}
