import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

const CINDY = "f4c61c87-ce26-4c0f-8a2f-f75565024f41";
const KESTER = "505c5990-e541-4471-a3c7-f2fb748a13e4";
const MAIN_BARN = "7bdb0bfc-6ab7-44a8-b625-2b6547ed25f8";
const HAYFIELD = "7824a03a-ee26-4f31-8d2b-562ae5fc9967";
const DATE = "2026-04-07";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const apply = process.argv.includes("--apply");
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await connection.query("SET time_zone = '+00:00'");
  await connection.beginTransaction();
  const [fields] = await connection.query(
    "SELECT id, name FROM fields WHERE id IN (?, ?, ?) LOCK IN SHARE MODE",
    [KESTER, MAIN_BARN, HAYFIELD],
  );
  if (fields.length !== 3 || fields.find((field) => field.id === KESTER)?.name !== "All Kester Fields" ||
      fields.find((field) => field.id === MAIN_BARN)?.name !== "Main Barn" ||
      fields.find((field) => field.id === HAYFIELD)?.name !== "Hayfield-Northwest") {
    throw new Error("Expected fields have changed; no movement added");
  }
  const [[animal]] = await connection.query(
    `SELECT id, tag_number AS tag, status, current_field_id AS currentField,
      DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS dob FROM animals WHERE id=? FOR UPDATE`, [CINDY],
  );
  if (!animal || animal.tag !== 'Cindy Lou  ("Cindy")' || animal.status !== "active" ||
      animal.currentField !== HAYFIELD || animal.dob !== "2023-05-26") {
    throw new Error("Cindy's current record changed; no movement added");
  }
  const [movements] = await connection.query(
    `SELECT id, from_field_id AS fromField, to_field_id AS toField,
      DATE_FORMAT(movement_date, '%Y-%m-%d %H:%i:%s') AS movedAt
      FROM movements WHERE animal_id=? ORDER BY movement_date, created_at, id FOR UPDATE`, [CINDY],
  );
  if (movements.length === 3 && movements[0].fromField === null && movements[0].toField === KESTER &&
      movements[0].movedAt.slice(0, 10) === DATE) {
    console.log("Cindy already has the 2026-04-07 arrival at All Kester Fields; no change needed");
    await connection.rollback();
  } else {
    if (movements.length !== 2 || movements[0].fromField !== KESTER ||
        movements[0].toField !== MAIN_BARN || movements[0].movedAt !== "2026-10-06 00:00:00" ||
        movements[1].fromField !== MAIN_BARN || movements[1].toField !== HAYFIELD ||
        movements[1].movedAt !== "2026-10-06 00:00:01") {
      throw new Error("Cindy's movement history changed; no movement added");
    }
    if (apply) {
      await connection.query(
        `INSERT INTO movements (id, animal_id, from_field_id, to_field_id, movement_date, notes)
         VALUES (?, ?, NULL, ?, ?, ?)`,
        [randomUUID(), CINDY, KESTER, `${DATE} 12:00:00`,
          "Historical arrival at All Kester Fields dated 2026-04-07 per owner; previous field not recorded"],
      );
      await connection.commit();
    } else await connection.rollback();
    console.log(`${apply ? "Added" : "Ready"}: Cindy Lou, ${DATE}, unknown prior field -> All Kester Fields`);
  }
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
