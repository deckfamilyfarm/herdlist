import crypto from "node:crypto";
import { Router } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { z } from "zod";
import { pool } from "./db";
import { isAdmin } from "./auth";
import {
  calculateGrazingServices, isServiceDate, isServiceMonth, serviceToday,
} from "../shared/grazingServices";
import { readGrazingServiceSource } from "./grazingServiceSource";

const id = z.string().min(1).max(36);
const date = z.string().refine(isServiceDate, "Choose a valid date");
const contractInput = z.object({
  name: z.string().trim().min(1).max(255), ownerId: id,
  kind: z.enum(["dairy", "general"]), activeFrom: date,
  activeTo: date.nullable(), dairyBarnFieldId: id.nullable(),
}).refine((value) => !value.activeTo || value.activeTo >= value.activeFrom,
  "End date must be on or after start date");
const assignmentInput = z.object({ animalId: id, startDate: date, endDate: date.nullable() })
  .refine((value) => !value.endDate || value.endDate >= value.startDate,
    "End date must be on or after start date");
const rateInput = z.object({
  effectiveDate: date,
  rateCents: z.number().int().min(0).max(100000000),
  seasonStartMonth: z.number().int().min(1).max(12).nullable().default(null),
  seasonEndMonth: z.number().int().min(1).max(12).nullable().default(null),
  ageThresholdMonths: z.number().int().min(1).max(240).nullable().default(null),
  olderRateCents: z.number().int().min(0).max(100000000).nullable().default(null),
  youngerRateCents: z.number().int().min(0).max(100000000).nullable().default(null),
  freeUnderMonths: z.number().int().min(1).max(240).nullable().default(null),
}).refine((value) => {
  const fields = [value.seasonStartMonth, value.seasonEndMonth, value.ageThresholdMonths,
    value.olderRateCents, value.youngerRateCents];
  return fields.every((field) => field === null) || fields.every((field) => field !== null);
}, "Complete every seasonal field, or leave all of them empty");
const validRateInput = rateInput.refine((value) =>
  value.freeUnderMonths === null || value.ageThresholdMonths === null ||
  value.freeUnderMonths <= value.ageThresholdMonths,
"Free age cutoff must be at or below the seasonal age threshold");
type DbRow = RowDataPacket & Record<string, any>;

async function exists(table: "owners" | "animals" | "fields" | "grazing_contracts", value: string) {
  const [rows] = await pool.query<DbRow[]>(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`, [value]);
  return rows.length > 0;
}

export function grazingServiceRoutes() {
  const router = Router();
  router.use(isAdmin);
  router.get("/owners", async (_req, res) => {
    try {
      const [rows] = await pool.query<DbRow[]>("SELECT id, name FROM owners ORDER BY name");
      res.json(rows);
    } catch (error) { res.status(500).json({ message: String(error) }); }
  });
  router.post("/owners", async (req, res) => {
    try {
      const name = z.string().trim().min(1).max(255).parse(req.body?.name);
      const ownerId = crypto.randomUUID();
      await pool.query("INSERT INTO owners (id, name) VALUES (?, ?)", [ownerId, name]);
      res.status(201).json({ id: ownerId, name });
    } catch (error) { respondError(res, error); }
  });
  router.get("/ownership/:animalId", async (req, res) => {
    try {
      const animalId = id.parse(req.params.animalId);
      const [rows] = await pool.query<DbRow[]>(`SELECT h.id, h.owner_id AS ownerId,
        o.name AS ownerName, DATE_FORMAT(h.effective_date, '%Y-%m-%d') AS effectiveDate
        FROM animal_ownership h JOIN owners o ON o.id = h.owner_id
        WHERE h.animal_id = ? ORDER BY h.effective_date`, [animalId]);
      res.json(rows);
    } catch (error) { respondError(res, error); }
  });
  router.put("/ownership/:animalId", async (req, res) => {
    try {
      const animalId = id.parse(req.params.animalId);
      const ownerId = id.parse(req.body?.ownerId);
      const effectiveDate = date.parse(req.body?.effectiveDate);
      if (effectiveDate > serviceToday()) return res.status(400).json({ message: "Future ownership dates are not supported" });
      if (!(await exists("animals", animalId)) || !(await exists("owners", ownerId)))
        return res.status(404).json({ message: "Animal or owner not found" });
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [locked] = await connection.query<DbRow[]>("SELECT id FROM animals WHERE id = ? FOR UPDATE", [animalId]);
        if (!locked.length) throw new Error("Animal no longer exists");
        await connection.query(`INSERT INTO animal_ownership (id, animal_id, owner_id, effective_date)
          VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE owner_id = VALUES(owner_id)`,
          [crypto.randomUUID(), animalId, ownerId, effectiveDate]);
        await connection.query(`UPDATE animals SET owner_id =
          (SELECT owner_id FROM animal_ownership WHERE animal_id = ? AND effective_date <= ?
           ORDER BY effective_date DESC LIMIT 1) WHERE id = ?`, [animalId, serviceToday(), animalId]);
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
      res.json({ animalId, ownerId, effectiveDate });
    } catch (error) { respondError(res, error); }
  });
  router.get("/contracts", async (_req, res) => {
    try {
      const [rows] = await pool.query<DbRow[]>(`SELECT c.id, c.name, c.owner_id AS ownerId,
        o.name AS ownerName, c.kind, DATE_FORMAT(c.active_from, '%Y-%m-%d') AS activeFrom,
        DATE_FORMAT(c.active_to, '%Y-%m-%d') AS activeTo,
        c.dairy_barn_field_id AS dairyBarnFieldId FROM grazing_contracts c
        JOIN owners o ON o.id = c.owner_id ORDER BY c.name`);
      res.json(rows);
    } catch (error) { respondError(res, error); }
  });
  async function saveContract(req: any, res: any, contractId?: string) {
    try {
      const value = contractInput.parse(req.body);
      if (!(await exists("owners", value.ownerId))) return res.status(404).json({ message: "Owner not found" });
      if (value.kind === "dairy" && value.dairyBarnFieldId && !(await exists("fields", value.dairyBarnFieldId)))
        return res.status(404).json({ message: "Dairy Barn field not found" });
      const savedId = contractId || crypto.randomUUID();
      if (contractId) {
        const [result] = await pool.query<ResultSetHeader>(`UPDATE grazing_contracts SET name = ?,
          owner_id = ?, kind = ?, active_from = ?, active_to = ?, dairy_barn_field_id = ? WHERE id = ?`,
          [value.name, value.ownerId, value.kind, value.activeFrom, value.activeTo,
            value.kind === "dairy" ? value.dairyBarnFieldId : null, savedId]);
        if (!result.affectedRows) return res.status(404).json({ message: "Contract not found" });
      } else {
        await pool.query(`INSERT INTO grazing_contracts
          (id, name, owner_id, kind, active_from, active_to, dairy_barn_field_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)`, [savedId, value.name, value.ownerId, value.kind,
          value.activeFrom, value.activeTo, value.kind === "dairy" ? value.dairyBarnFieldId : null]);
      }
      res.status(contractId ? 200 : 201).json({ id: savedId, ...value });
    } catch (error) { respondError(res, error); }
  }
  router.post("/contracts", (req, res) => saveContract(req, res));
  router.put("/contracts/:id", (req, res) => saveContract(req, res, req.params.id));
  router.get("/contracts/:id/assignments", async (req, res) => {
    try {
      const contractId = id.parse(req.params.id);
      const [rows] = await pool.query<DbRow[]>(`SELECT a.id, a.animal_id AS animalId,
        n.tag_number AS tagNumber, DATE_FORMAT(a.start_date, '%Y-%m-%d') AS startDate,
        DATE_FORMAT(a.end_date, '%Y-%m-%d') AS endDate FROM grazing_assignments a
        JOIN animals n ON BINARY n.id = BINARY a.animal_id WHERE a.contract_id = ?
        ORDER BY n.tag_number, a.start_date`, [contractId]);
      res.json(rows);
    } catch (error) { respondError(res, error); }
  });
  router.post("/contracts/:id/assignments", async (req, res) => {
    try {
      const contractId = id.parse(req.params.id);
      const value = assignmentInput.parse(req.body);
      if (!(await exists("grazing_contracts", contractId)) || !(await exists("animals", value.animalId)))
        return res.status(404).json({ message: "Contract or animal not found" });
      const [kinds] = await pool.query<DbRow[]>("SELECT kind FROM grazing_contracts WHERE id = ?", [contractId]);
      if (kinds[0].kind !== "general") return res.status(400).json({ message: "Assignments belong to general contracts" });
      const assignmentId = crypto.randomUUID();
      await pool.query(`INSERT INTO grazing_assignments (id, contract_id, animal_id, start_date, end_date)
        VALUES (?, ?, ?, ?, ?)`, [assignmentId, contractId, value.animalId, value.startDate, value.endDate]);
      res.status(201).json({ id: assignmentId, contractId, ...value });
    } catch (error) { respondError(res, error); }
  });
  router.put("/assignments/:id", async (req, res) => {
    try {
      const assignmentId = id.parse(req.params.id);
      const value = assignmentInput.parse(req.body);
      if (!(await exists("animals", value.animalId))) return res.status(404).json({ message: "Animal not found" });
      const [result] = await pool.query<ResultSetHeader>(`UPDATE grazing_assignments SET animal_id = ?,
        start_date = ?, end_date = ? WHERE id = ?`,
        [value.animalId, value.startDate, value.endDate, assignmentId]);
      if (!result.affectedRows) return res.status(404).json({ message: "Assignment not found" });
      res.json({ id: assignmentId, ...value });
    } catch (error) { respondError(res, error); }
  });
  router.delete("/assignments/:id", async (req, res) => {
    try {
      const assignmentId = id.parse(req.params.id);
      const [result] = await pool.query<ResultSetHeader>("DELETE FROM grazing_assignments WHERE id = ?", [assignmentId]);
      if (!result.affectedRows) return res.status(404).json({ message: "Assignment not found" });
      res.status(204).end();
    } catch (error) { respondError(res, error); }
  });
  router.get("/contracts/:id/rates", async (req, res) => {
    try {
      const contractId = id.parse(req.params.id);
      if (!(await exists("grazing_contracts", contractId))) return res.status(404).json({ message: "Contract not found" });
      const [rows] = await pool.query<DbRow[]>(`SELECT contract_id AS contractId,
        DATE_FORMAT(effective_date, '%Y-%m-%d') AS effectiveDate,
        rate_cents AS rateCents, season_start_month AS seasonStartMonth,
        season_end_month AS seasonEndMonth, age_threshold_months AS ageThresholdMonths,
        older_rate_cents AS olderRateCents, younger_rate_cents AS youngerRateCents,
        free_under_months AS freeUnderMonths
        FROM grazing_rates WHERE contract_id = ? ORDER BY effective_date`, [contractId]);
      res.json(rows);
    } catch (error) { respondError(res, error); }
  });
  router.post("/contracts/:id/rates", async (req, res) => {
    try {
      const contractId = id.parse(req.params.id);
      const value = validRateInput.parse(req.body);
      if (value.effectiveDate < "2015-01-01") return res.status(400).json({ message: "Rates begin on or after January 1, 2015" });
      if (!(await exists("grazing_contracts", contractId))) return res.status(404).json({ message: "Contract not found" });
      await pool.query(`INSERT INTO grazing_rates (contract_id, effective_date, rate_cents,
        season_start_month, season_end_month, age_threshold_months, older_rate_cents, younger_rate_cents,
        free_under_months) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [contractId, value.effectiveDate, value.rateCents,
        value.seasonStartMonth, value.seasonEndMonth, value.ageThresholdMonths,
        value.olderRateCents, value.youngerRateCents, value.freeUnderMonths]);
      res.status(201).json({ contractId, ...value });
    } catch (error) { respondError(res, error); }
  });
  router.put("/contracts/:id/rates/:effectiveDate", async (req, res) => {
    try {
      const contractId = id.parse(req.params.id);
      const originalDate = date.parse(req.params.effectiveDate);
      const value = validRateInput.parse(req.body);
      if (value.effectiveDate < "2015-01-01") return res.status(400).json({ message: "Rates begin on or after January 1, 2015" });
      const [result] = await pool.query<ResultSetHeader>(`UPDATE grazing_rates SET effective_date = ?, rate_cents = ?,
        season_start_month = ?, season_end_month = ?, age_threshold_months = ?,
        older_rate_cents = ?, younger_rate_cents = ?, free_under_months = ?
        WHERE contract_id = ? AND effective_date = ?`, [value.effectiveDate, value.rateCents,
        value.seasonStartMonth, value.seasonEndMonth, value.ageThresholdMonths,
        value.olderRateCents, value.youngerRateCents, value.freeUnderMonths, contractId, originalDate]);
      if (!result.affectedRows) return res.status(404).json({ message: "Rate not found" });
      res.json({ contractId, ...value });
    } catch (error) { respondError(res, error); }
  });
  router.delete("/contracts/:id/rates/:effectiveDate", async (req, res) => {
    try {
      const contractId = id.parse(req.params.id);
      const effectiveDate = date.parse(req.params.effectiveDate);
      const [result] = await pool.query<ResultSetHeader>(
        "DELETE FROM grazing_rates WHERE contract_id = ? AND effective_date = ?", [contractId, effectiveDate]);
      if (!result.affectedRows) return res.status(404).json({ message: "Rate not found" });
      res.status(204).end();
    } catch (error) { respondError(res, error); }
  });
  router.get("/report", async (req, res) => {
    try {
      const month = z.string().refine(isServiceMonth).parse(req.query.month);
      if (month > serviceToday().slice(0, 7)) return res.status(400).json({ message: "Future months are unavailable" });
      res.setHeader("Cache-Control", "no-store");
      res.json(calculateGrazingServices(await readGrazingServiceSource(pool), month));
    } catch (error) { respondError(res, error); }
  });
  return router;
}

function respondError(res: any, error: unknown) {
  if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: error.issues });
  if ((error as { code?: string })?.code === "ER_DUP_ENTRY")
    return res.status(409).json({ message: "That value already exists" });
  if (error instanceof Error && error.message === "Invalid report month")
    return res.status(400).json({ message: error.message });
  console.error("Grazing Services request failed", error);
  return res.status(500).json({ message: "Grazing Services request failed" });
}
