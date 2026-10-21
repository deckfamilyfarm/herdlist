import type { RowDataPacket } from "mysql2";
import type { Pool, PoolConnection } from "mysql2/promise";
import type { ServiceSource } from "../shared/grazingServices";

type DbRow = RowDataPacket & Record<string, any>;

// The API and the monthly PDF use the same source data and billing rules.
// A cron job can pass a transaction connection for a consistent monthly snapshot.
export async function readGrazingServiceSource(db: Pool | PoolConnection): Promise<ServiceSource> {
  const [animalResult, fieldResult, movementResult, ownerResult, exitResult,
    deathResult, contractResult, assignmentResult, rateResult] = await Promise.all([
    db.query<DbRow[]>(`SELECT id, tag_number AS tagNumber, phenotype, type, sex, status,
      DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS dateOfBirth,
      current_field_id AS currentFieldId FROM animals`),
    db.query<DbRow[]>("SELECT id, name FROM fields"),
    db.query<DbRow[]>(`SELECT id, animal_id AS animalId,
      from_field_id AS fromFieldId, to_field_id AS toFieldId,
      UNIX_TIMESTAMP(movement_date) AS movementUnix,
      UNIX_TIMESTAMP(created_at) AS createdUnix FROM movements`),
    db.query<DbRow[]>(`SELECT animal_id AS animalId, owner_id AS ownerId,
      DATE_FORMAT(effective_date, '%Y-%m-%d') AS effectiveDate FROM animal_ownership`),
    db.query<DbRow[]>(`SELECT animal_id AS animalId,
      DATE_FORMAT(slaughter_date, '%Y-%m-%d') AS date FROM slaughter_records`),
    db.query<DbRow[]>(`SELECT animal_id AS animalId,
      DATE_FORMAT(event_date, '%Y-%m-%d') AS date FROM events WHERE LOWER(TRIM(event_type)) = 'death'`),
    db.query<DbRow[]>(`SELECT c.id, c.name, c.owner_id AS ownerId, o.name AS ownerName,
      c.kind, DATE_FORMAT(c.active_from, '%Y-%m-%d') AS activeFrom,
      DATE_FORMAT(c.active_to, '%Y-%m-%d') AS activeTo,
      c.dairy_barn_field_id AS dairyBarnFieldId
      FROM grazing_contracts c JOIN owners o ON o.id = c.owner_id ORDER BY c.name`),
    db.query<DbRow[]>(`SELECT id, contract_id AS contractId, animal_id AS animalId,
      DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
      DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate FROM grazing_assignments`),
    db.query<DbRow[]>(`SELECT contract_id AS contractId,
      DATE_FORMAT(effective_date, '%Y-%m-%d') AS effectiveDate,
      rate_cents AS rateCents, season_start_month AS seasonStartMonth,
      season_end_month AS seasonEndMonth, age_threshold_months AS ageThresholdMonths,
      older_rate_cents AS olderRateCents, younger_rate_cents AS youngerRateCents,
      free_under_months AS freeUnderMonths
      FROM grazing_rates ORDER BY contract_id, effective_date`),
  ]);
  return {
    animals: animalResult[0] as ServiceSource["animals"],
    fields: fieldResult[0] as ServiceSource["fields"],
    movements: movementResult[0].map((row) => ({
      id: row.id, animalId: row.animalId, fromFieldId: row.fromFieldId, toFieldId: row.toFieldId,
      movementDate: new Date(Number(row.movementUnix) * 1000).toISOString(),
      createdAt: new Date(Number(row.createdUnix) * 1000).toISOString(),
    })),
    ownership: ownerResult[0] as ServiceSource["ownership"],
    exits: [...exitResult[0], ...deathResult[0]] as ServiceSource["exits"],
    contracts: contractResult[0] as ServiceSource["contracts"],
    assignments: assignmentResult[0] as ServiceSource["assignments"],
    rates: rateResult[0] as ServiceSource["rates"],
  };
}
