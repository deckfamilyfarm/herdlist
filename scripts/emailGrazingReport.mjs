#!/usr/bin/env node
// Standalone monthly Creamy Cow dairy grazing report. See docs/grazing-services.md.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import nodemailer from "nodemailer";
import { addServiceMonths, calculateGrazingServices, isServiceMonth, serviceToday } from "../shared/grazingServices.ts";
import { readGrazingServiceSource } from "../server/grazingServiceSource.ts";
import { renderGrazingReportPdf } from "./grazingReportPdf.mjs";
import { combineGrazingRangePdfs, monthsEndingAt } from "./grazingReportRange.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultTo = "jdeck88@gmail.com";
const contractId = "creamy-cow-dairy";
const money = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

function optionsFrom(argv) {
  const options = { month: "", months: "1", out: "", to: defaultTo, mailEnv: "", noEmail: false, resend: false, help: false };
  for (let index = 0; index < argv.length; index++) {
    const item = argv[index];
    if (item === "--no-email" || item === "--resend" || item === "--help") {
      options[item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = true;
    } else if (["--month", "--months", "-n", "--out", "--to", "--mail-env"].includes(item)) {
      if (!argv[index + 1] || argv[index + 1].startsWith("-")) throw new Error(`${item} needs a value`);
      const key = item === "-n" ? "months" : item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      options[key] = argv[++index];
    } else throw new Error(`Unknown option: ${item}`);
  }
  return options;
}

function mailTransport() {
  const host = process.env.SMTP_HOST || process.env.MAIL_HOST;
  const user = process.env.SMTP_USER || process.env.MAIL_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.MAIL_ACCESS || process.env.MAIL_PASS || process.env.EMAIL_PASS;
  if (!user || !pass) throw new Error("Email credentials are missing. Set MAIL_USER/MAIL_ACCESS or SMTP_USER/SMTP_PASS.");
  const transport = host ? nodemailer.createTransport({
    host, port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    auth: { user, pass },
  }) : nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  return { transport, from: process.env.EMAIL_FROM || user };
}

async function writePdf(outputPath, pdf) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporaryPath, pdf, { mode: 0o600 });
    await fs.rename(temporaryPath, outputPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
}

async function main() {
  const options = optionsFrom(process.argv.slice(2));
  if (options.help) {
    console.log("Usage: node --import tsx scripts/emailGrazingReport.mjs [--month YYYY-MM] [-n N | --months N] [--out FILE.pdf] [--to ADDRESS] [--mail-env FILE] [--no-email] [--resend]");
    return;
  }
  dotenv.config({ path: path.join(root, ".env"), quiet: true });
  const mailEnvFile = options.mailEnv || process.env.GRAZING_MAIL_ENV_FILE;
  if (mailEnvFile) {
    const mailEnvPath = path.resolve(root, mailEnvFile);
    const result = dotenv.config({ path: mailEnvPath, quiet: true });
    if (result.error) throw new Error(`Could not load mail environment file: ${mailEnvPath}`);
  }
  const today = serviceToday();
  const month = options.month || addServiceMonths(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
  if (!isServiceMonth(month) || month >= today.slice(0, 7))
    throw new Error("Choose a completed month in YYYY-MM format");
  const months = monthsEndingAt(month, Number(options.months));
  const firstMonth = months[0];
  const reportKey = months.length === 1 ? month : `${firstMonth}_to_${month}`;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing from Herdlist .env");
  const defaultName = months.length === 1 ? `${month}-creamy-cow-dairy.pdf` :
    `${firstMonth}_to_${month}-creamy-cow-dairy-summary.pdf`;
  const outputPath = path.resolve(root, options.out || `reports/grazing-services/${defaultName}`);
  const sentMarker = `${outputPath}.sent.json`;
  if (!options.noEmail && !options.resend) {
    try {
      const prior = JSON.parse(await fs.readFile(sentMarker, "utf8"));
      if ((prior.reportKey === reportKey || (months.length === 1 && prior.month === month)) && prior.to === options.to) {
        console.log(`Already emailed ${reportKey} to ${options.to}; use --resend to send a revised report.`);
        return;
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const pool = mysql.createPool(process.env.DATABASE_URL);
  let source;
  try {
    const connection = await pool.getConnection();
    try {
      await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await connection.beginTransaction();
      source = await readGrazingServiceSource(connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  } finally { await pool.end(); }
  const rates = source.rates.filter((rate) => rate.contractId === contractId);
  const items = [];
  for (const itemMonth of months) {
    const report = calculateGrazingServices(source, itemMonth, today);
    const contract = report.contracts.find((item) => item.id === contractId);
    if (!contract) throw new Error("Creamy Cow dairy contract was not found");
    if (contract.ownerId !== "creamy-cow-llc" || contract.kind !== "dairy")
      throw new Error("Creamy Cow dairy contract owner or service type has changed; journal entries need review");
    if (contract.unpricedHeadDays)
      throw new Error(`${itemMonth}: ${contract.unpricedHeadDays} Creamy Cow head-days have no rate; set the contract rate before emailing`);
    const issues = report.issues.filter((issue) => issue.contractIds.includes(contractId));
    const pdf = await renderGrazingReportPdf({ report, contract, rates, issues });
    const individualPath = months.length === 1 ? outputPath :
      path.join(path.dirname(outputPath), `${itemMonth}-creamy-cow-dairy.pdf`);
    items.push({ month: itemMonth, contract, issues, pdf, individualPath });
  }
  const pdf = months.length === 1 ? items[0].pdf : await combineGrazingRangePdfs(items);
  if (months.length > 1) for (const item of items) await writePdf(item.individualPath, item.pdf);
  await writePdf(outputPath, pdf);
  const totalCents = items.reduce((sum, item) => sum + item.contract.amountCents, 0);
  console.log(`Created ${outputPath} (${pdf.length} bytes). ${firstMonth} to ${month}: ${money(totalCents)}.`);
  for (const item of items) console.log(`  ${item.month}: ${item.contract.rows.length} animals, ${item.contract.headDays} head-days, ${money(item.contract.amountCents)}, ${item.issues.length} warnings`);
  if (options.noEmail) return;
  const { transport, from } = mailTransport();
  const subject = `Creamy Cow dairy grazing charges - ${months.length === 1 ? month : `${firstMonth} to ${month}`} - ${money(totalCents)}`;
  const body = [
    `Deck Family Farm Grazing / Creamy Cow, LLC - ${firstMonth} to ${month}`,
    "",
    `Total grazing charges: ${money(totalCents)}`,
    "Month | Animals | Head-days | Charge | Warnings",
    ...items.map((item) => `${item.month} | ${item.contract.rows.length} | ${item.contract.headDays} | ${money(item.contract.amountCents)} | ${item.issues.length}`),
    "",
    months.length === 1 ? "The attached PDF contains the two proposed journal entries, animal detail, and warnings." :
      "The summary PDF starts with a table of every month and contains each monthly journal and animal detail section. Individual monthly PDFs are also attached.",
    `Report ID: GRAZING-${reportKey}`,
  ].join("\n");
  const attachments = [{ filename: path.basename(outputPath), content: pdf, contentType: "application/pdf" },
    ...(months.length > 1 ? items.map((item) => ({ filename: path.basename(item.individualPath),
      content: item.pdf, contentType: "application/pdf" })) : [])];
  await transport.sendMail({ from, to: options.to, subject, text: body,
    attachments });
  await fs.writeFile(sentMarker, JSON.stringify({ reportKey, month, firstMonth, to: options.to,
    sentAt: new Date().toISOString(), amountCents: totalCents, attachments: attachments.map((item) => item.filename) }) + "\n", { mode: 0o600 });
  console.log(`Emailed ${attachments.length} PDF ${attachments.length === 1 ? "file" : "files"} to ${options.to}.`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
