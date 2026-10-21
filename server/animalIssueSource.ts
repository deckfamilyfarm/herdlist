import type { RowDataPacket } from "mysql2";
import type { Pool } from "mysql2/promise";
import { findAnimalIssues, type AnimalIssueSource } from "../shared/animalIssues";
import { serviceToday } from "../shared/grazingServices";

type Row = RowDataPacket & Record<string, any>;

export async function readAnimalIssues(pool: Pool) {
  const [animals, fields, owners, ownership, movements] = await Promise.all([
    pool.query<Row[]>(`SELECT id, tag_number AS tagNumber, type, status,
      DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS dateOfBirth,
      current_field_id AS currentFieldId, owner_id AS ownerId FROM animals`),
    pool.query<Row[]>("SELECT id, name FROM fields"),
    pool.query<Row[]>("SELECT id, name FROM owners"),
    pool.query<Row[]>(`SELECT animal_id AS animalId, owner_id AS ownerId,
      DATE_FORMAT(effective_date, '%Y-%m-%d') AS effectiveDate FROM animal_ownership`),
    pool.query<Row[]>(`SELECT id, animal_id AS animalId, to_field_id AS toFieldId,
      UNIX_TIMESTAMP(movement_date) AS movementUnix,
      UNIX_TIMESTAMP(created_at) AS createdUnix FROM movements`),
  ]);
  const source: AnimalIssueSource = {
    animals: animals[0] as AnimalIssueSource["animals"],
    fields: fields[0] as AnimalIssueSource["fields"],
    owners: owners[0] as AnimalIssueSource["owners"],
    ownership: ownership[0] as AnimalIssueSource["ownership"],
    movements: movements[0].map((move) => ({
      id: move.id, animalId: move.animalId, toFieldId: move.toFieldId,
      movementDate: new Date(Number(move.movementUnix) * 1000).toISOString(),
      createdAt: new Date(Number(move.createdUnix) * 1000).toISOString(),
    })),
  };
  return findAnimalIssues(source, serviceToday());
}
