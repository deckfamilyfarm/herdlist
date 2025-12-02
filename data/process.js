#!/usr/bin/env node

// process.js (ES module version)
// Usage: node process.js /path/to/HerdList.xlsx
// Requires: npm install xlsx

import fs from "fs";
import path from "path";
import XLSX from "xlsx";

/* ---------------- CLI & file checks ---------------- */

if (!process.argv[2]) {
  console.error("Usage: node process.js <path-to-excel-file>");
  process.exit(1);
}

const inputPath = process.argv[2];

if (!fs.existsSync(inputPath)) {
  console.error("File not found:", inputPath);
  process.exit(1);
}

/* ---------------- Helpers ---------------- */

function normalizeHeader(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

/**
 * Find column index by candidate header names.
 * If allowMissing is false, throws if not found.
 */
function findCol(headerRow, candidates, allowMissing = false) {
  const normCandidates = candidates.map(normalizeHeader);
  for (let i = 0; i < headerRow.length; i++) {
    const h = normalizeHeader(headerRow[i]);
    if (normCandidates.includes(h)) {
      return i;
    }
  }
  if (!allowMissing) {
    throw new Error(
      `Could not find any of headers [${candidates.join(
        ", "
      )}] in row: ${headerRow.join(" | ")}`
    );
  }
  return -1;
}

// Convert any value to YYYY-MM-DD or "".
function normalizeDate(v) {
  if (v == null || v === "") return "";

  // Excel serial number
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return "";
    const yyyy = d.y;
    const mm = String(d.m).padStart(2, "0");
    const dd = String(d.d).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // JS Date
  if (v instanceof Date) {
    const yyyy = v.getFullYear();
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const dd = String(v.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // String
  let s = String(v).trim();
  if (!s) return "";

  // Already looks like YYYY-MM-DD or YYYY-MM-DD hh:mm:ss
  const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (isoMatch) return isoMatch[1];

  // Basic mm/dd/yy or mm/dd/yyyy parsing fallback
  const mdMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(s);
  if (mdMatch) {
    let [_, m, d, y] = mdMatch;
    m = String(parseInt(m, 10)).padStart(2, "0");
    d = String(parseInt(d, 10)).padStart(2, "0");
    y = parseInt(y, 10);
    if (y < 100) y += y >= 70 ? 1900 : 2000;
    return `${y}-${m}-${d}`;
  }

  // Last resort: let Date try, then format
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
}

function normalizeSex(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "";
  if (s.startsWith("m")) return "male";
  if (s.startsWith("f")) return "female";
  return "";
}

// Try to pull herdName from herd string
// Desired values: wet, nurse, finish, main, grafting, yearlings
function deriveHerdName(raw) {
  if (raw == null) return "";
  const base = String(raw).toLowerCase();
  const herds = ["wet", "nurse", "finish", "main", "grafting",  "yearling", "missing", "bull"];

  // 1) Prefer a known herd keyword inside the string
  for (const h of herds) {
    if (base.includes(h)) return h === "yearling" ? "yearlings" : h;
  }

  // 2) Fallback: first part before dash, then first word
  let beforeDash = base.split("-")[0].trim(); // e.g. "wet dairy"
  if (beforeDash) {
    const firstWord = beforeDash.split(/\s+/)[0]; // "wet"
    return firstWord;
  }

  return "";
}

// Map name → type (your rule: leading "*" means dairy)
function deriveType(tagNumber) {
  const n = String(tagNumber || "");
  if (n.startsWith("*")) {
    return "dairy";
  } else {
    return "beef";
  }
}

// Derive breedingMethod from Notes
// live-cover or ai
function deriveBreedingMethod(notes) {
  if (!notes) return "";
  const s = String(notes).toLowerCase();

  if (s.includes("ai")) return "ai";
  if (
    s.includes("live cover") ||
    s.includes("live-cover") ||
    s.includes("livecover") ||
    s.includes("bull")
  ) {
    return "live-cover";
  }

  const bullHints = ["hercules", "ivano", "credits", "roberto", "bernard", "shaggy"];
  if (bullHints.some((b) => s.includes(b))) return "live-cover";

  return "";
}

// Organic: true if value mentions OTCO or "organic", else false
function deriveOrganic(raw) {
  if (!raw && raw !== 0) return "false";
  const s = String(raw).toLowerCase();
  if (s.includes("otco") || s.includes("organic")) return "true";
  return "false";
}

// CSV escaping
function csvEscape(value) {
  if (value == null) value = "";
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/* ---------------- Main ---------------- */

function main() {
  const wb = XLSX.readFile(inputPath);
  const firstSheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheetName];

  // header:1 → array-of-arrays
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });

  if (!rows.length) {
    console.error("No rows found in sheet:", firstSheetName);
    process.exit(1);
  }

  // --- detect the header row dynamically ---
  const headerRowIndex = rows.findIndex((r) =>
    r.some((c) => {
      const v = String(c || "").toLowerCase();
      return (
        v === "tag" ||
        v === "markings" ||
        v === "m/f" ||
        v === "dob" ||
        v.includes("tag") ||
        v.includes("markings")
      );
    })
  );

  if (headerRowIndex === -1) {
    throw new Error(
      "Could not find header row — please check that the sheet has a row with headers like Tag, Markings, M/F, DOB, etc."
    );
  }

  const headerRow = rows[headerRowIndex].map((v) => String(v || "").trim());
  const dataRows = rows.slice(headerRowIndex + 1);

  // Match columns based on header row
  const tagIdx = findCol(headerRow, ["Tag"]); // tagNumber source
  const nameIdx = findCol(headerRow, ["Markings", "Name"]);
  const sexIdx = findCol(headerRow, ["M/F", "Sex"]);
  const dobIdx = findCol(headerRow, ["DOB", "DateOfBirth", "Date of Birth"]);
  const sireIdx = findCol(headerRow, ["Sire"]);
  const damIdx = findCol(headerRow, ["Dam"]);
  const herdIdx = findCol(headerRow, ["Herd"]); // herdName source
  const organicIdx = findCol(headerRow, ["OTCO/Nat", "OTCO", "Organic"]);
  const notesIdx = findCol(headerRow, ["Notes"], true); // optional

  const outputHeader = [
    "tagNumber",
    "name",
    "type",
    "sex",
    "dateOfBirth",
    "breedingMethod",
    "sireTag",
    "damTag",
    "herdName",
    "organic",
  ];

  const outRows = [outputHeader.join(",")];

  let emptyRowStreak = 0; // for "two empty rows then stop"

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];

    // Check if this row is completely empty
    const isCompletelyEmpty = row.every((cell) => String(cell ?? "").trim() === "");
    if (isCompletelyEmpty) {
      emptyRowStreak += 1;
      if (emptyRowStreak >= 2) {
        // Two empty rows in a row → end of data
        break;
      }
      // Single empty row: just skip it
      continue;
    } else {
      emptyRowStreak = 0;
    }

    const tagRaw = row[tagIdx];

    // Skip if no tag value at all
    if (tagRaw == null || String(tagRaw).trim() === "") {
      continue;
    }

    // Force text and trim
    let tagNumberText = String(tagRaw).trim();

    // If the tagNumber field reads just "Tag", don't ingest this row
    if (tagNumberText.toLowerCase() === "tag") {
      continue;
    }

    // In tagNumber, discard everything after the "-" including the "-"
    // Also trim the result
    tagNumberText = tagNumberText.split("-")[0].trim();

    const baseName = row[nameIdx] != null ? String(row[nameIdx]).trim() : "";
    const notes = notesIdx >= 0 ? String(row[notesIdx] ?? "").trim() : "";

    // Your rule: name = Markings + " - " + Notes
	const name = baseName && notes ? `${baseName} - ${notes}` : baseName || notes;


    const sex = normalizeSex(row[sexIdx]);
    const dateOfBirth = normalizeDate(row[dobIdx]);
    const sireTag = row[sireIdx] != null ? String(row[sireIdx]).trim() : "";
    const damTag = row[damIdx] != null ? String(row[damIdx]).trim() : "";

    const herdRaw = row[herdIdx];
    const herdName = deriveHerdName(herdRaw);
    const type = deriveType(tagNumberText);

    const organic = deriveOrganic(row[organicIdx]);
    const breedingMethod = deriveBreedingMethod(notes);

    const outRow = [
      tagNumberText, // forced text, trimmed, before "-"
      name,
      type,
      sex,
      dateOfBirth,
      breedingMethod,
      sireTag,
      damTag,
      herdName,
      organic,
    ].map(csvEscape);

    outRows.push(outRow.join(","));
  }

  const csvContent = outRows.join("\n");
  const outPath = path.join("./", "animals.csv");
  fs.writeFileSync(outPath, csvContent, "utf8");

  console.log("Wrote:", outPath);
}

main();

