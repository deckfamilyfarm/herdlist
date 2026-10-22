import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

const CINDY = "f4c61c87-ce26-4c0f-8a2f-f75565024f41";
const ALL_DECK = "92493246-d4df-4a9f-a43d-130ed21a20a5";
const KESTER = "505c5990-e541-4471-a3c7-f2fb748a13e4";
const HAYFIELD = "7824a03a-ee26-4f31-8d2b-562ae5fc9967";
const JANUARY = "2026-01-01";
const APRIL = "2026-04-07";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const apply = process.argv.includes("--apply");
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await db.query("SET time_zone = '+00:00'");
  await db.beginTransaction();
  const [fields] = await db.query("SELECT id, name FROM fields WHERE id IN (?, ?, ?) LOCK IN SHARE MODE",
    [ALL_DECK, KESTER, HAYFIELD]);
  if (fields.length !== 3 || fields.find((field) => field.id === ALL_DECK)?.name !== "All Deck Family Farm Fields" ||
      fields.find((field) => field.id === KESTER)?.name !== "All Kester Fields" ||
      fields.find((field) => field.id === HAYFIELD)?.name !== "Hayfield-Northwest")
    throw new Error("Cindy's reviewed field IDs changed");
  const [[animal]] = await db.query("SELECT tag_number AS tag, status, current_field_id AS fieldId FROM animals WHERE id=? FOR UPDATE", [CINDY]);
  if (!animal || animal.tag !== 'Cindy Lou  ("Cindy")' || animal.status !== "active" || animal.fieldId !== HAYFIELD)
    throw new Error("Cindy's animal record changed");
  const [moves] = await db.query(`SELECT id, from_field_id AS fromField, to_field_id AS toField,
    DATE_FORMAT(movement_date, '%Y-%m-%d %H:%i:%s') AS movedAt
    FROM movements WHERE animal_id=? ORDER BY movement_date, created_at, id FOR UPDATE`, [CINDY]);
  const january = moves.find((move) => move.movedAt.slice(0, 10) === JANUARY);
  const april = moves.find((move) => move.movedAt.slice(0, 10) === APRIL);
  if (moves.length === 4 && january?.fromField === null && january.toField === ALL_DECK &&
      april?.fromField === ALL_DECK && april.toField === KESTER) {
    await db.rollback();
    console.log("Cindy already has January 1 All Deck and April 7 All Kester movements");
  } else {
    if (moves.length !== 3 || january || !april || april.fromField !== null || april.toField !== KESTER ||
        april.movedAt !== "2026-04-07 12:00:00" ||
        moves[1].fromField !== KESTER || moves[1].movedAt !== "2026-10-06 00:00:00" ||
        moves[2].fromField !== moves[1].toField || moves[2].toField !== HAYFIELD ||
        moves[2].movedAt !== "2026-10-06 00:00:01")
      throw new Error("Cindy's movement history changed; no correction applied");
    if (apply) {
      await db.query(`INSERT INTO movements (id, animal_id, from_field_id, to_field_id, movement_date, notes)
        VALUES (?, ?, NULL, ?, ?, ?)`, [randomUUID(), CINDY, ALL_DECK, `${JANUARY} 12:00:00`,
        "Initial 2026 location at All Deck Family Farm Fields, provided by owner on 2026-10-21"]);
      await db.query("UPDATE movements SET from_field_id=?, notes=? WHERE id=?", [ALL_DECK,
        "Moved from All Deck Family Farm Fields to All Kester Fields on 2026-04-07 per owner", april.id]);
      await db.commit();
    } else await db.rollback();
    console.log(`${apply ? "Recorded" : "Ready"}: January 1 All Deck; April 7 All Deck -> All Kester Fields`);
  }
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
