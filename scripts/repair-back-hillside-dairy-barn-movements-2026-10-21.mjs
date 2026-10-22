import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

const BARN = "a90d6e0f-8876-4eaf-8667-ae7ec20d833e";
const BACK_HILLSIDE = "cc3e78c9-aeda-4269-be57-d48480a547e3";
const repairs = [
  { id: "0705b8f8-48c6-4842-84a7-2d0241b30ce6", tag: "Bombay", lastMove: "2026-05-05", calf: "Bay", date: "2026-05-22" },
  { id: "65192817-f4fa-4edb-bb7c-6843c36291f0", tag: "Lady MacBeth", lastMove: "2026-04-14", calf: "Lydia", date: "2026-04-29" },
];

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const apply = process.argv.includes("--apply");
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await connection.query("SET time_zone = '+00:00'");
  await connection.beginTransaction();

  const [fields] = await connection.query("SELECT id, name FROM fields WHERE id IN (?, ?) LOCK IN SHARE MODE", [BARN, BACK_HILLSIDE]);
  if (fields.length !== 2 || fields.find((field) => field.id === BARN)?.name !== "Dairy Barn" ||
      fields.find((field) => field.id === BACK_HILLSIDE)?.name !== "Back Hillside") {
    throw new Error("Expected locations have changed; no repairs made");
  }

  for (const repair of repairs) {
    const [[animal]] = await connection.query(
      "SELECT id, tag_number AS tag, status, current_field_id AS field FROM animals WHERE id = ? FOR UPDATE",
      [repair.id],
    );
    if (!animal || animal.tag !== repair.tag || animal.status !== "active" || animal.field !== BARN) {
      throw new Error(`${repair.tag}: current animal record changed; no repairs made`);
    }
    const [[latest]] = await connection.query(
      `SELECT to_field_id AS destination, UNIX_TIMESTAMP(movement_date) AS movedAt
       FROM movements WHERE animal_id = ?
       ORDER BY movement_date DESC, created_at DESC, id DESC LIMIT 1 FOR UPDATE`,
      [repair.id],
    );
    const latestDay = latest && new Date(Number(latest.movedAt) * 1000).toISOString().slice(0, 10);
    if (!latest || latest.destination !== BACK_HILLSIDE || latestDay !== repair.lastMove || repair.date <= latestDay) {
      throw new Error(`${repair.tag}: latest movement changed; no repairs made`);
    }
    const [[calf]] = await connection.query(
      `SELECT tag_number AS tag, DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS dob
       FROM animals WHERE dam_id = ? AND date_of_birth IS NOT NULL
       ORDER BY date_of_birth DESC, id DESC LIMIT 1`,
      [repair.id],
    );
    if (!calf || calf.tag !== repair.calf || calf.dob !== repair.date) {
      throw new Error(`${repair.tag}: latest offspring birth date changed; no repairs made`);
    }
    if (apply) {
      await connection.query(
        `INSERT INTO movements (id, animal_id, from_field_id, to_field_id, movement_date, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), repair.id, BACK_HILLSIDE, BARN, `${repair.date} 12:00:00`,
          `Dairy Barn return dated from latest offspring birth date (${repair.calf}), per owner`],
      );
    }
    console.log(`${apply ? "Added" : "Ready"}: ${repair.tag}, ${repair.date}, Back Hillside -> Dairy Barn`);
  }

  if (apply) await connection.commit();
  else await connection.rollback();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
