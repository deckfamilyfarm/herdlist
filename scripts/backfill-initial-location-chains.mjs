import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const manifestPath = process.argv[2];
if (!manifestPath || manifestPath === "--apply")
  throw new Error("Usage: node scripts/backfill-initial-location-chains.mjs MANIFEST.json [--apply]");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const apply = process.argv.includes("--apply");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (!Array.isArray(manifest.animals) || manifest.animals.length === 0 ||
    new Set(manifest.animals.map((animal) => animal.id)).size !== manifest.animals.length)
  throw new Error("Manifest must contain distinct animals");

const validTimestamp = (value) => typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value.replace(" ", "T")}Z`)) &&
  new Date(`${value.replace(" ", "T")}Z`).toISOString().slice(0, 19).replace("T", " ") === value;
const fieldId = (key) => {
  if (key === null) return null;
  const field = manifest.fields?.[key];
  if (!field?.id || !field?.name || field.name.trim().toLowerCase() === "missing")
    throw new Error(`Unknown or unusable field key: ${key}`);
  return field.id;
};
const match = (actual, planned) => Boolean(actual) && actual.movedAt === planned.at &&
  actual.fromFieldId === fieldId(planned.from) && actual.toFieldId === fieldId(planned.to);

for (const plan of manifest.animals) {
  if (!plan.id || !plan.tag || !plan.damId || !/^\d{4}-\d{2}-\d{2}$/.test(plan.dob) ||
      !Array.isArray(plan.steps) || !plan.steps.length || !validTimestamp(plan.firstRecorded?.at))
    throw new Error(`Invalid plan for ${plan.tag || plan.id}`);
  fieldId(plan.currentField);
  if (plan.steps[0].from !== null) throw new Error(`${plan.tag}: first move must start from an unknown prior field`);
  for (let index = 0; index < plan.steps.length; index++) {
    const step = plan.steps[index];
    if (!validTimestamp(step.at) || step.at.slice(0, 10) < plan.dob ||
        step.at >= plan.firstRecorded.at || !step.note || step.note.length > 1000 || !step.to ||
        (index > 0 && (step.at <= plan.steps[index - 1].at || step.from !== plan.steps[index - 1].to)))
      throw new Error(`${plan.tag}: invalid or discontinuous dated move`);
    fieldId(step.from);
    fieldId(step.to);
  }
  if (plan.steps.at(-1).to !== plan.firstRecorded.from)
    throw new Error(`${plan.tag}: proposed chain does not reach first recorded movement origin`);
  fieldId(plan.firstRecorded.to);
}

const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await db.query("SET time_zone = '+00:00'");
  await db.beginTransaction();
  for (const [key, expected] of Object.entries(manifest.fields)) {
    const [[field]] = await db.query("SELECT name FROM fields WHERE id=? LOCK IN SHARE MODE", [expected.id]);
    if (!field || field.name !== expected.name) throw new Error(`${key}: field changed; no moves added`);
  }
  let ready = 0;
  let existing = 0;
  for (const plan of manifest.animals) {
    const [[calf]] = await db.query(`SELECT tag_number AS tag, dam_id AS damId, status,
      current_field_id AS currentFieldId, DATE_FORMAT(date_of_birth,'%Y-%m-%d') AS dob
      FROM animals WHERE id=? FOR UPDATE`, [plan.id]);
    if (!calf || calf.tag !== plan.tag || calf.damId !== plan.damId || calf.dob !== plan.dob ||
        calf.currentFieldId !== fieldId(plan.currentField) || calf.status !== "active")
      throw new Error(`${plan.tag}: animal record changed; no moves added`);
    const [moves] = await db.query(`SELECT from_field_id AS fromFieldId, to_field_id AS toFieldId,
      DATE_FORMAT(movement_date,'%Y-%m-%d %H:%i:%s') AS movedAt
      FROM movements WHERE animal_id=? ORDER BY movement_date, created_at, id FOR UPDATE`, [plan.id]);
    if (!moves.length || moves.at(-1).toFieldId !== calf.currentFieldId)
      throw new Error(`${plan.tag}: current field and latest movement disagree`);
    if (moves.slice(0, plan.steps.length).every((move, index) => match(move, plan.steps[index])) &&
        match(moves[plan.steps.length], plan.firstRecorded)) {
      existing++;
      console.log(`Already present: ${plan.tag}`);
      continue;
    }
    if (!match(moves[0], plan.firstRecorded))
      throw new Error(`${plan.tag}: earliest movement changed; no moves added`);
    ready++;
    if (apply) for (const step of plan.steps) {
      await db.query(`INSERT INTO movements
        (id, animal_id, from_field_id, to_field_id, movement_date, notes)
        VALUES (?, ?, ?, ?, ?, ?)`,
      [randomUUID(), plan.id, fieldId(step.from), fieldId(step.to), step.at, step.note]);
    }
    console.log(`${apply ? "Added" : "Ready"}: ${plan.tag}, ${plan.steps.length} dated move(s)`);
  }
  if (apply) await db.commit();
  else await db.rollback();
  console.log(`${ready} ${apply ? "repaired" : "ready"}; ${existing} already present`);
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
