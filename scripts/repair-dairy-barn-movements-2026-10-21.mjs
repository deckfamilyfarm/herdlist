import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

const BARN = "a90d6e0f-8876-4eaf-8667-ae7ec20d833e";
const FARM_FIELDS = "92493246-d4df-4a9f-a43d-130ed21a20a5";
const repairs = [
  { id: "2c7fbb88-cb6f-4262-8e94-477be7cc267c", tag: "Blue", date: "2026-01-01", latestCalfDob: "2025-09-03" },
  { id: "1ab721a7-0ad8-455b-b99b-c7cb1f72ceed", tag: "Catalan", date: "2026-01-01", latestCalfDob: "2025-07-11" },
  { id: "964786b1-6322-4f70-8e41-51d45ad6fe17", tag: "Nutmeg", date: "2026-01-01", latestCalfDob: "2025-08-18" },
  { id: "99ae6bcd-337f-4ff2-af24-8af05fff7693", tag: "Sage", date: "2026-02-15", latestCalfDob: "2026-02-15" },
];

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const apply = process.argv.includes("--apply");
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await connection.query("SET time_zone = '+00:00'");
  await connection.beginTransaction();

  const [fields] = await connection.query("SELECT id, name FROM fields WHERE id IN (?, ?) LOCK IN SHARE MODE", [BARN, FARM_FIELDS]);
  if (fields.length !== 2 || fields.find((field) => field.id === BARN)?.name !== "Dairy Barn" ||
      fields.find((field) => field.id === FARM_FIELDS)?.name !== "All Deck Family Farm Fields") {
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
      `SELECT id, to_field_id AS destination, UNIX_TIMESTAMP(movement_date) AS movedAt
       FROM movements WHERE animal_id = ?
       ORDER BY movement_date DESC, created_at DESC, id DESC LIMIT 1 FOR UPDATE`,
      [repair.id],
    );
    const latestDay = latest && new Date(Number(latest.movedAt) * 1000).toISOString().slice(0, 10);
    if (!latest || latest.destination !== FARM_FIELDS || latestDay !== "2025-12-03" || repair.date <= latestDay) {
      throw new Error(`${repair.tag}: latest movement changed; no repairs made`);
    }
    const [[calf]] = await connection.query(
      "SELECT MAX(DATE_FORMAT(date_of_birth, '%Y-%m-%d')) AS latestCalfDob FROM animals WHERE dam_id = ?",
      [repair.id],
    );
    if (calf.latestCalfDob !== repair.latestCalfDob) {
      throw new Error(`${repair.tag}: latest offspring birth date changed; no repairs made`);
    }
    if (apply) {
      const notes = repair.date === repair.latestCalfDob
        ? "Dairy Barn return dated from latest offspring birth date, per owner"
        : "Dairy Barn return dated 2026-01-01 per owner; exact historical move date unknown";
      await connection.query(
        `INSERT INTO movements (id, animal_id, from_field_id, to_field_id, movement_date, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), repair.id, FARM_FIELDS, BARN, `${repair.date} 12:00:00`, notes],
      );
    }
    console.log(`${apply ? "Added" : "Ready"}: ${repair.tag}, ${repair.date}, All Deck Family Farm Fields -> Dairy Barn`);
  }

  if (apply) await connection.commit();
  else await connection.rollback();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
