import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const manifest = JSON.parse(await readFile(new URL("./calf-birth-location-backfill-2026-10-21.json", import.meta.url), "utf8"));
if (manifest.length !== 35 || new Set(manifest.map((row) => row.id)).size !== 35 ||
    !["2554", "2555", "Hona"].every((tag) => manifest.some((row) => row.tag === tag))) {
  throw new Error("Expected 35 reviewed calf records, including 2554, 2555, and Hona");
}
const apply = process.argv.includes("--apply");
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await connection.query("SET time_zone = '+00:00'");
  await connection.beginTransaction();
  let ready = 0;
  let existing = 0;
  for (const entry of manifest) {
    const [[calf]] = await connection.query(
      `SELECT id, tag_number AS tag, dam_id AS damId, current_field_id AS currentFieldId,
        DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS dob FROM animals WHERE id=? FOR UPDATE`, [entry.id],
    );
    if (!calf || calf.tag !== entry.tag || calf.damId !== entry.damId || calf.dob !== entry.dob) {
      throw new Error(`${entry.tag}: calf record changed; no birth locations added`);
    }
    const [[field]] = await connection.query("SELECT name FROM fields WHERE id=? LOCK IN SHARE MODE", [entry.fieldId]);
    if (!field || field.name !== entry.field || field.name.trim().toLowerCase() === "missing") {
      throw new Error(`${entry.tag}: birth field changed; no birth locations added`);
    }
    const [[dam]] = await connection.query("SELECT tag_number AS tag FROM animals WHERE id=? LOCK IN SHARE MODE", [entry.damId]);
    if (!dam || dam.tag !== entry.damTag) throw new Error(`${entry.tag}: dam changed; no birth locations added`);
    const [[damAtBirth]] = await connection.query(
      `SELECT to_field_id AS fieldId FROM movements WHERE animal_id=? AND movement_date < ?
        ORDER BY movement_date DESC, created_at DESC, id DESC LIMIT 1 LOCK IN SHARE MODE`,
      [entry.damId, `${entry.dob} 23:59:59`],
    );
    if (!damAtBirth || damAtBirth.fieldId !== entry.fieldId) {
      throw new Error(`${entry.tag}: dam's dated birth field changed; no birth locations added`);
    }
    const [calfMoves] = await connection.query(
      `SELECT from_field_id AS fromFieldId, to_field_id AS toFieldId,
        DATE_FORMAT(movement_date, '%Y-%m-%d %H:%i:%s') AS movedAt
        FROM movements WHERE animal_id=? ORDER BY movement_date, created_at, id FOR UPDATE`, [entry.id],
    );
    const birthMove = calfMoves.find((move) => move.movedAt.slice(0, 10) === entry.dob &&
      move.fromFieldId === null && move.toFieldId === entry.fieldId);
    if (birthMove) { existing++; continue; }
    if (calfMoves.some((move) => move.movedAt.slice(0, 10) <= entry.dob)) {
      throw new Error(`${entry.tag}: calf already has a different birth-day location; no birth locations added`);
    }
    const first = calfMoves[0];
    if (Boolean(first) !== Boolean(entry.firstMove) ||
        (first && (first.movedAt !== entry.firstMove.slice(0, 19) ||
          first.fromFieldId !== entry.firstFromFieldId))) {
      throw new Error(`${entry.tag}: first recorded movement changed; no birth locations added`);
    }
    if (!first && calf.currentFieldId !== entry.fieldId) {
      throw new Error(`${entry.tag}: current field changed; no birth locations added`);
    }
    if (first && first.fromFieldId === null) {
      const [[damIntermediate]] = await connection.query(
        `SELECT id FROM movements WHERE animal_id=? AND movement_date > ? AND movement_date < ? LIMIT 1 LOCK IN SHARE MODE`,
        [entry.damId, `${entry.dob} 23:59:59`, first.movedAt],
      );
      if (damIntermediate) throw new Error(`${entry.tag}: dam's interim movements changed; no birth locations added`);
    }
    ready++;
    if (apply) await connection.query(
      `INSERT INTO movements (id, animal_id, from_field_id, to_field_id, movement_date, notes)
        VALUES (?, ?, NULL, ?, ?, ?)`,
      [randomUUID(), entry.id, entry.fieldId, `${entry.dob} 12:00:00`,
        `Birth field inferred from dam ${entry.damTag}'s dated movement history; reviewed 2026-10-21`],
    );
    console.log(`${apply ? "Added" : "Ready"}: ${entry.tag}, ${entry.dob}, ${entry.field}`);
  }
  if (apply) await connection.commit();
  else await connection.rollback();
  console.log(`${ready} ${apply ? "added" : "ready"}; ${existing} already present`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
