import mysql from "mysql2/promise";
import { readGrazingServiceSource } from "../server/grazingServiceSource.ts";
import { calculateGrazingServices } from "../shared/grazingServices.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const source = await readGrazingServiceSource(db);
  const report = calculateGrazingServices(source, "2026-04", "2026-10-21");
  const warnings = report.issues.filter((issue) => issue.code === "unknownLocation");
  const targetTags = new Set(["2601", "2602", "Blossom", "Juju"]);
  console.log(JSON.stringify({ count: warnings.length, warnings: warnings.map((issue) => ({
    tag: issue.tagNumber, firstDate: issue.firstDate, lastDate: issue.lastDate, days: issue.days,
    contractIds: issue.contractIds,
  })), targetRows: report.contracts.flatMap((contract) => contract.rows
    .filter((row) => targetTags.has(row.tagNumber))
    .map((row) => ({ tag: row.tagNumber, contract: contract.name, headDays: row.headDays, amountCents: row.amountCents }))) }, null, 2));
} finally {
  await db.end();
}
