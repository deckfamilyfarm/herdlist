import crypto from "node:crypto";
import type { Pool } from "mysql2/promise";
import type { HistoryEntry } from "../shared/movementHistory";

const problem = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });
const sameEntry = (a: HistoryEntry, b: HistoryEntry) =>
  a.fromFieldId === b.fromFieldId && a.toFieldId === b.toFieldId &&
  Date.parse(a.movementDate) === Date.parse(b.movementDate) && a.notes === b.notes;

// History repairs deliberately leave the current animal location unchanged.
// A backdated entry is evidence about the past, rather than a transfer today.
export async function saveMovementHistory(pool: Pool, input: {
  animalId?: string; id?: string; entry: HistoryEntry; expected?: HistoryEntry;
}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let animalId = input.animalId;
    if (input.id) {
      const [rows] = await connection.query<any[]>(`SELECT id, animal_id AS animalId,
        from_field_id AS fromFieldId, to_field_id AS toFieldId,
        DATE_FORMAT(movement_date, '%Y-%m-%dT%H:%i:%s.000Z') AS movementDate, notes
        FROM movements WHERE id = ? FOR UPDATE`, [input.id]);
      const original = rows[0];
      if (!original) throw problem(404, "Movement no longer exists. Refresh the history.");
      if (!input.expected || !sameEntry(original, input.expected))
        throw problem(409, "This movement changed since you opened it. Refresh and review before saving.");
      animalId = original.animalId;
    }
    const [animals] = await connection.query<any[]>("SELECT id FROM animals WHERE id = ? LOCK IN SHARE MODE", [animalId]);
    if (!animals.length) throw problem(404, "Animal no longer exists.");
    const fieldIds = Array.from(new Set([input.entry.fromFieldId, input.entry.toFieldId].filter((id): id is string => !!id)));
    const [fields] = await connection.query<any[]>(
      `SELECT id FROM fields WHERE id IN (${fieldIds.map(() => "?").join(",")}) LOCK IN SHARE MODE`, fieldIds);
    if (fields.length !== fieldIds.length) throw problem(400, "Choose existing from/to locations.");
    const id = input.id || crypto.randomUUID();
    const entry = input.entry;
    const date = new Date(entry.movementDate).toISOString().slice(0, 19).replace("T", " ");
    if (input.id) {
      await connection.query(`UPDATE movements SET from_field_id = ?, to_field_id = ?,
        movement_date = ?, notes = ? WHERE id = ?`, [entry.fromFieldId, entry.toFieldId, date, entry.notes, id]);
    } else {
      await connection.query(`INSERT INTO movements
        (id, animal_id, from_field_id, to_field_id, movement_date, notes) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, animalId, entry.fromFieldId, entry.toFieldId, date, entry.notes]);
    }
    await connection.commit();
    return { id, animalId, ...entry };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
