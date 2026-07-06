import { db, pool } from "./db";
import { eq, sql, and, or, gte, desc, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";

import crypto from "crypto";
import {
  animals,
  properties,
  fields,
  hayRecords,
  fieldAmendmentRecords,
  movements,
  vaccinations,
  events,
  calvingRecords,
  slaughterRecords,
  users,
  notes,
  breedingRecords,
  livestockLots,
  livestockLotCountEvents,
  livestockLotMovements,
  livestockSpeciesSettings,
  type Animal,
  type AnimalDueDateStatus,
  type AnimalListItem,
  type InsertAnimal,
  type Property,
  type InsertProperty,
  type Field,
  type InsertField,
  type FieldHaySummary,
  type HayRecord,
  type HayRecordWithMetrics,
  type InsertHayRecord,
  type FieldAmendmentRecord,
  type InsertFieldAmendmentRecord,
  type Movement,
  type InsertMovement,
  type Vaccination,
  type InsertVaccination,
  type Event,
  type InsertEvent,
  type CalvingRecord,
  type InsertCalvingRecord,
  type SlaughterRecord,
  type InsertSlaughterRecord,
  type User,
  type Note,
  type InsertNote,
  type BreedingRecord,
  type InsertBreedingRecord,
  type PolledStatus,
  type LivestockLot,
  type LivestockLotListItem,
  type InsertLivestockLot,
  type UpdateLivestockLot,
  type LivestockLotCountEvent,
  type InsertLivestockLotCountEvent,
  type LivestockLotMovement,
  type MoveLivestockLotInput,
  type LivestockSpeciesSettings,
  type UpsertLivestockSpeciesSettings,
  type LivestockInventoryByField,
  type LivestockRecentMovement,
} from "@shared/schema";

console.log("DB check:", typeof (db as any).insert, typeof (db as any).select);

const normalizePolledStatus = (value: any): PolledStatus => {
  if (value === "polled" || value === "horned" || value === "not tested") {
    return value;
  }

  if (value === true || value === 1) return "polled";
  if (value === false || value === 0) return "not tested";

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "polled") return "polled";
    if (normalized === "horned") return "horned";
    if (
      normalized === "not tested" ||
      normalized === "not_tested" ||
      normalized === "nottested" ||
      normalized === "untested"
    ) {
      return "not tested";
    }
    if (normalized === "true" || normalized === "yes" || normalized === "y") return "polled";
    if (normalized === "false" || normalized === "no" || normalized === "n" || normalized === "0") {
      return "not tested";
    }
  }

  return "not tested";
};

const formatDateOnly = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDateOnlyString = (value: unknown): string | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : formatDateOnly(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : formatDateOnly(parsed);
};

const parseDateOnly = (value: unknown): Date | null => {
  const dateOnly = toDateOnlyString(value);
  if (!dateOnly) return null;

  const [year, month, day] = dateOnly.split("-").map((part) => parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
};

const addDateOnlyDays = (date: Date, days: number) => {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const lotCountKeys = ["ewes", "rams", "lambs", "wethers", "unknown"] as const;
type LotCountKey = (typeof lotCountKeys)[number];
type LotCounts = Record<LotCountKey, number>;

const defaultSheepClassLabels: Record<LotCountKey, string> = {
  ewes: "Ewes",
  rams: "Rams",
  lambs: "Lambs",
  wethers: "Wethers",
  unknown: "Unknown",
};

const defaultSheepSettings: UpsertLivestockSpeciesSettings = {
  species: "sheep",
  displayName: "Sheep",
  trackingMode: "lot",
  lotLabel: "Flock",
  classLabels: defaultSheepClassLabels,
  allowPartialLotMoves: true,
  allowSplitMerge: true,
  allowIndividualTracking: false,
  requireCorrectionReason: true,
};

const isMissingLivestockTableError = (error: any) =>
  error?.code === "ER_NO_SUCH_TABLE" &&
  typeof error?.message === "string" &&
  error.message.includes("livestock_");

const getLotCounts = (lot: Pick<LivestockLot, LotCountKey>): LotCounts => ({
  ewes: Number(lot.ewes || 0),
  rams: Number(lot.rams || 0),
  lambs: Number(lot.lambs || 0),
  wethers: Number(lot.wethers || 0),
  unknown: Number(lot.unknown || 0),
});

const getLotTotal = (counts: Partial<Record<LotCountKey, number>> | Pick<LivestockLot, LotCountKey>) =>
  lotCountKeys.reduce((sum, key) => sum + Number((counts as any)[key] || 0), 0);

const getMoveCounts = (input: MoveLivestockLotInput, source: LivestockLot): LotCounts => {
  if (input.moveEntireLot) {
    return getLotCounts(source);
  }
  return {
    ewes: Number(input.ewes || 0),
    rams: Number(input.rams || 0),
    lambs: Number(input.lambs || 0),
    wethers: Number(input.wethers || 0),
    unknown: Number(input.unknown || 0),
  };
};

const subtractLotCounts = (source: LivestockLot, moved: LotCounts): LotCounts => {
  const current = getLotCounts(source);
  return {
    ewes: current.ewes - moved.ewes,
    rams: current.rams - moved.rams,
    lambs: current.lambs - moved.lambs,
    wethers: current.wethers - moved.wethers,
    unknown: current.unknown - moved.unknown,
  };
};

const addLotCounts = (lot: LivestockLot, added: LotCounts): LotCounts => {
  const current = getLotCounts(lot);
  return {
    ewes: current.ewes + added.ewes,
    rams: current.rams + added.rams,
    lambs: current.lambs + added.lambs,
    wethers: current.wethers + added.wethers,
    unknown: current.unknown + added.unknown,
  };
};

const ensureNonNegativeLotCounts = (counts: LotCounts) => {
  const negativeKey = lotCountKeys.find((key) => counts[key] < 0);
  if (negativeKey) {
    throw new Error(`Cannot reduce ${negativeKey} below zero.`);
  }
};

const toLotListItem = (
  lot: LivestockLot & { currentFieldName?: string | null; propertyName?: string | null },
): LivestockLotListItem => ({
  ...(lot as any),
  totalCount: getLotTotal(lot),
});

const addDateOnlyMonths = (date: Date, months: number) => {
  const firstOfTargetMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
  const targetYear = firstOfTargetMonth.getUTCFullYear();
  const targetMonth = firstOfTargetMonth.getUTCMonth();
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(targetYear, targetMonth, Math.min(date.getUTCDate(), lastDayOfTargetMonth)),
  );
};

const getTodayDateOnly = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

const resolveSlaughterRecordType = (
  value: unknown,
  fallback: "slaughtered" | "sold" = "slaughtered",
  hasSoldSignals = false,
): "slaughtered" | "sold" => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "sold") return "sold";
  if (normalized === "slaughtered") return "slaughtered";
  if (hasSoldSignals) return "sold";
  return fallback;
};

const isMissingSlaughterColumnError = (error: unknown) => {
  const code = (error as any)?.code;
  const message = String((error as any)?.message ?? "");
  return code === "ER_BAD_FIELD_ERROR" || /unknown column/i.test(message);
};

const isStatusEnumError = (error: unknown) => {
  const code = (error as any)?.code;
  const message = String((error as any)?.message ?? "");
  return (
    code === "WARN_DATA_TRUNCATED" ||
    code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD" ||
    /data truncated for column 'status'/i.test(message)
  );
};

const parseLegacySoldBuyer = (processor: unknown): string | null => {
  if (typeof processor !== "string") return null;
  if (!processor.startsWith("SOLD:")) return null;
  const value = processor.slice(5).trim();
  return value || null;
};

const mapSlaughterRow = (row: any): SlaughterRecord => {
  const legacyBuyer = parseLegacySoldBuyer(row.processor);
  const buyer = row.buyer ?? legacyBuyer ?? null;
  const pricePerLb = row.price_per_lb ?? row.pricePerLb ?? null;
  const recordType = resolveSlaughterRecordType(
    row.record_type ?? row.recordType,
    "slaughtered",
    Boolean(buyer || pricePerLb),
  );

  return {
    id: row.id,
    animalId: row.animal_id ?? row.animalId,
    recordType,
    slaughterDate: row.slaughter_date ?? row.slaughterDate,
    ageMonths: row.age_months ?? row.ageMonths ?? null,
    liveWeight: row.live_weight ?? row.liveWeight ?? null,
    hangingWeight: row.hanging_weight ?? row.hangingWeight ?? null,
    processor: legacyBuyer ? null : (row.processor ?? null),
    buyer,
    pricePerLb,
    createdAt: row.created_at ?? row.createdAt,
  } as SlaughterRecord;
};

const toFiniteNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const withHayMetrics = (record: HayRecord): HayRecordWithMetrics => {
  const totalDmTons =
    (toFiniteNumber(record.baleCount) *
      toFiniteNumber(record.baleWeightLbs) *
      (toFiniteNumber(record.dryMatterPercent) / 100)) /
    2000;
  const acresCut = toFiniteNumber(record.acresCut);

  return {
    ...record,
    totalDmTons,
    tonDmPerAcre: acresCut > 0 ? totalDmTons / acresCut : null,
  };
};

const cleanFieldAmendmentRecord = (
  record: InsertFieldAmendmentRecord,
): InsertFieldAmendmentRecord => {
  if (record.amendmentType === "reseeding") {
    return {
      ...record,
      manureRateYardsPerAcre: null,
      manureSource: null,
      spreaderType: null,
      limeType: null,
      limeTonsPerAcre: null,
    };
  }

  if (record.amendmentType === "manure") {
    return {
      ...record,
      seedNotes: null,
      limeType: null,
      limeTonsPerAcre: null,
    };
  }

  return {
    ...record,
    seedNotes: null,
    manureRateYardsPerAcre: null,
    manureSource: null,
    spreaderType: null,
  };
};

const setAnimalRemovalStatus = async (
  animalId: string,
  recordType: "slaughtered" | "sold",
) => {
  const desiredStatus = recordType === "sold" ? "sold" : "slaughtered";
  try {
    await db
      .update(animals)
      .set({
        status: desiredStatus,
        currentFieldId: null,
        herdName: null,
      })
      .where(eq(animals.id, animalId));
  } catch (error: any) {
    // Legacy DBs may not yet have status enum value "sold".
    if (recordType === "sold" && isStatusEnumError(error)) {
      await db
        .update(animals)
        .set({
          status: "slaughtered",
          currentFieldId: null,
          herdName: null,
        })
        .where(eq(animals.id, animalId));
      return;
    }
    throw error;
  }
};

export interface IStorage {
  // Animals
  createAnimal(animal: InsertAnimal): Promise<Animal>;
  getAllAnimals(): Promise<AnimalListItem[]>;
  getAnimalById(id: string): Promise<Animal | undefined>;
  updateAnimal(id: string, animal: Partial<InsertAnimal>): Promise<Animal | undefined>;
  deleteAnimal(id: string): Promise<void>;
  getAnimalsReadyToBreed(): Promise<Animal[]>;
  getOffspringByParentId(parentId: string): Promise<Animal[]>;

  // Livestock lots
  createLivestockLot(lot: InsertLivestockLot): Promise<LivestockLot>;
  getAllLivestockLots(): Promise<LivestockLotListItem[]>;
  getLivestockLotById(id: string): Promise<LivestockLotListItem | undefined>;
  updateLivestockLot(id: string, lot: UpdateLivestockLot): Promise<LivestockLot | undefined>;
  deleteLivestockLot(id: string): Promise<void>;
  createLivestockLotCountEvent(
    lotId: string,
    event: InsertLivestockLotCountEvent,
  ): Promise<LivestockLotCountEvent>;
  getLivestockLotCountEvents(lotId: string): Promise<LivestockLotCountEvent[]>;
  moveLivestockLot(lotId: string, movement: MoveLivestockLotInput): Promise<LivestockLotMovement>;
  getRecentLivestockMovements(limit?: number): Promise<LivestockRecentMovement[]>;
  getLivestockSpeciesSettings(species?: string): Promise<LivestockSpeciesSettings[]>;
  upsertLivestockSpeciesSettings(
    settings: UpsertLivestockSpeciesSettings,
  ): Promise<LivestockSpeciesSettings>;

  // Properties
  createProperty(property: InsertProperty): Promise<Property>;
  getAllProperties(): Promise<Property[]>;
  getPropertyById(id: string): Promise<Property | undefined>;
  updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property | undefined>;
  deleteProperty(id: string): Promise<void>;

  // Fields
  createField(field: InsertField): Promise<Field>;
  getAllFields(): Promise<Field[]>;
  getFieldById(id: string): Promise<Field | undefined>;
  getFieldsByPropertyId(propertyId: string): Promise<Field[]>;
  updateField(id: string, field: Partial<InsertField>): Promise<Field | undefined>;
  deleteField(id: string): Promise<void>;
  createHayRecord(record: InsertHayRecord): Promise<HayRecordWithMetrics>;
  getHayRecordById(id: string): Promise<HayRecord | undefined>;
  getHayRecordsByFieldId(fieldId: string): Promise<HayRecordWithMetrics[]>;
  updateHayRecord(id: string, record: InsertHayRecord): Promise<HayRecordWithMetrics | undefined>;
  deleteHayRecord(id: string): Promise<void>;
  getHayRecordSummaries(year: number): Promise<FieldHaySummary[]>;
  createFieldAmendmentRecord(record: InsertFieldAmendmentRecord): Promise<FieldAmendmentRecord>;
  getFieldAmendmentRecordById(id: string): Promise<FieldAmendmentRecord | undefined>;
  getFieldAmendmentRecordsByFieldId(fieldId: string): Promise<FieldAmendmentRecord[]>;
  updateFieldAmendmentRecord(
    id: string,
    record: InsertFieldAmendmentRecord,
  ): Promise<FieldAmendmentRecord | undefined>;
  deleteFieldAmendmentRecord(id: string): Promise<void>;
  getCurrentAnimalCountByField(): Promise<LivestockInventoryByField[]>;

  // Movements
  createMovement(movement: InsertMovement): Promise<Movement>;
  getAllMovements(): Promise<Movement[]>;
  getMovementsByAnimalId(animalId: string): Promise<Movement[]>;
  getRecentMovements(limit?: number): Promise<Movement[]>;

  // Vaccinations
  createVaccination(vaccination: InsertVaccination): Promise<Vaccination>;
  getVaccinationsByAnimalId(animalId: string): Promise<Vaccination[]>;
  updateVaccination(id: string, vaccination: Partial<InsertVaccination>): Promise<Vaccination | undefined>;
  deleteVaccination(id: string): Promise<void>;

  // Events
  createEvent(event: InsertEvent): Promise<Event>;
  getEventsByAnimalId(animalId: string): Promise<Event[]>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<void>;

  // Notes
  createNote(note: InsertNote): Promise<Note>;
  bulkCreateNotes(notes: InsertNote[]): Promise<Note[]>;
  getNotesByAnimalId(animalId: string): Promise<Note[]>;
  getLatestNotesByAnimal(): Promise<{ animalId: string; note: string; noteDate: string }[]>;
  updateNote(id: string, note: Partial<InsertNote>): Promise<Note | undefined>;
  deleteNote(id: string): Promise<void>;

  // Calving Records
  createCalvingRecord(record: InsertCalvingRecord): Promise<CalvingRecord>;
  getCalvingRecordsByDamId(damId: string): Promise<CalvingRecord[]>;
  updateCalvingRecord(id: string, record: Partial<InsertCalvingRecord>): Promise<CalvingRecord | undefined>;
  deleteCalvingRecord(id: string): Promise<void>;

  // Breeding Records
  createBreedingRecord(record: InsertBreedingRecord): Promise<BreedingRecord>;
  getBreedingRecordsByAnimalId(animalId: string): Promise<BreedingRecord[]>;
  updateBreedingRecord(id: string, record: Partial<InsertBreedingRecord>): Promise<BreedingRecord | undefined>;
  deleteBreedingRecord(id: string): Promise<void>;

  // Slaughter/Sold Records
  createSlaughterRecord(record: InsertSlaughterRecord): Promise<SlaughterRecord>;
  updateSlaughterRecord(id: string, record: InsertSlaughterRecord): Promise<SlaughterRecord | undefined>;
  getAllSlaughterRecords(): Promise<SlaughterRecord[]>;
  getSlaughterRecordById(id: string): Promise<SlaughterRecord | undefined>;
  deleteSlaughterRecord(id: string): Promise<void>;

  // Bulk updates
  moveAnimalsToField(
    animalIds: string[],
    fieldId: string,
    options?: { movementDate?: Date; note?: string },
  ): Promise<void>;
  updateAnimalsTags(animalIds: string[], tags: string[]): Promise<void>;
  removeAnimalsTags(animalIds: string[], tags: string[]): Promise<void>;

  // Bulk Import
  bulkCreateAnimals(animals: InsertAnimal[]): Promise<Animal[]>;
  bulkCreateProperties(properties: InsertProperty[]): Promise<Property[]>;
  bulkCreateFields(fields: InsertField[]): Promise<Field[]>;
  bulkCreateVaccinations(vaccinations: InsertVaccination[]): Promise<Vaccination[]>;
  bulkCreateEvents(events: InsertEvent[]): Promise<Event[]>;
  bulkCreateCalvingRecords(records: InsertCalvingRecord[]): Promise<CalvingRecord[]>;
  bulkCreateSlaughterRecords(records: InsertSlaughterRecord[]): Promise<SlaughterRecord[]>;

  // Lookup helpers for imports
  getAnimalByTagNumber(tagNumber: string): Promise<Animal | undefined>;
  getPropertyByName(name: string): Promise<Property | undefined>;
  getFieldByNameAndProperty(fieldName: string, propertyId: string): Promise<Field | undefined>;

  // User operations for authentication
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: {
    email: string;
    passwordHash: string;
    firstName?: string;
    lastName?: string;
    isAdmin?: string;
  }): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserAdminStatus(id: string, isAdmin: string): Promise<User | undefined>;
  updateUserPassword(id: string, passwordHash: string): Promise<User | undefined>;
  setPasswordResetToken(email: string, token: string, expires: Date): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  clearPasswordResetToken(id: string): Promise<User | undefined>;
}

export class DatabaseStorage implements IStorage {
  // ---------- Animals ----------

  async createAnimal(animal: InsertAnimal): Promise<Animal> {
    const id = crypto.randomUUID();
    const polledValue = normalizePolledStatus((animal as any).polled);

    await db.insert(animals).values({
      ...(animal as any),
      polled: polledValue,
      id,
    });

    const [created] = await db.select().from(animals).where(eq(animals.id, id));
    return { ...(created as any), polled: normalizePolledStatus((created as any).polled) } as Animal;
  }

  async getAllAnimals(): Promise<AnimalListItem[]> {
    const sireAnimals = alias(animals, "sire_animals");
    const damAnimals = alias(animals, "dam_animals");

    const [result, breedingRows, calvingRows] = await Promise.all([
      db
        .select({
          id: animals.id,
          tagNumber: animals.tagNumber,
          type: animals.type,
          sex: animals.sex,
          dateOfBirth: animals.dateOfBirth,
          status: animals.status,
          sireId: animals.sireId,
          damId: animals.damId,
          currentFieldId: animals.currentFieldId,
          herdName: animals.herdName,
          createdAt: animals.createdAt,
          phenotype: animals.phenotype,
          organic: animals.organic,
          polled: animals.polled,
          tags: animals.tags,
          betacasein: animals.betacasein,
          currentFieldName: fields.name,
          sireTagNumber: sireAnimals.tagNumber,
          damTagNumber: damAnimals.tagNumber,
        })
        .from(animals)
        .leftJoin(fields, eq(animals.currentFieldId, fields.id))
        .leftJoin(sireAnimals, eq(animals.sireId, sireAnimals.id))
        .leftJoin(damAnimals, eq(animals.damId, damAnimals.id)),
      db
        .select({
          id: breedingRecords.id,
          animalId: breedingRecords.animalId,
          breedingDate: breedingRecords.breedingDate,
          exposureStartDate: breedingRecords.exposureStartDate,
          createdAt: breedingRecords.createdAt,
        })
        .from(breedingRecords),
      db
        .select({
          damId: calvingRecords.damId,
          calvingDate: calvingRecords.calvingDate,
        })
        .from(calvingRecords),
    ]);

    const calvingDatesByDamId = new Map<string, Date[]>();
    const addCalvingDate = (damId: string | null | undefined, calvingDateValue: unknown) => {
      if (!damId) return;
      const calvingDate = parseDateOnly(calvingDateValue);
      if (!calvingDate) return;

      const existing = calvingDatesByDamId.get(damId) ?? [];
      existing.push(calvingDate);
      calvingDatesByDamId.set(damId, existing);
    };

    for (const row of calvingRows) {
      addCalvingDate(row.damId, row.calvingDate);
    }

    for (const animal of result) {
      addCalvingDate(animal.damId, animal.dateOfBirth);
    }

    const breedingDatesByAnimalId = new Map<
      string,
      { id: string; firstExposureDate: Date; createdAtTime: number }[]
    >();

    for (const row of breedingRows) {
      const firstExposureDate = parseDateOnly(row.exposureStartDate ?? row.breedingDate);
      if (!firstExposureDate) continue;

      const createdAtTime =
        row.createdAt instanceof Date
          ? row.createdAt.getTime()
          : new Date(row.createdAt as any).getTime();
      const existing = breedingDatesByAnimalId.get(row.animalId) ?? [];
      existing.push({
        id: row.id,
        firstExposureDate,
        createdAtTime: Number.isNaN(createdAtTime) ? 0 : createdAtTime,
      });
      breedingDatesByAnimalId.set(row.animalId, existing);
    }

    Array.from(breedingDatesByAnimalId.values()).forEach((breedingDates) => {
      breedingDates.sort((a, b) => {
        const byExposure = b.firstExposureDate.getTime() - a.firstExposureDate.getTime();
        return byExposure !== 0 ? byExposure : b.createdAtTime - a.createdAtTime;
      });
    });

    const today = getTodayDateOnly();

    const getDueDateInfo = (
      animalId: string,
      sex: string,
    ): {
      dueDate: string | null;
      dueDateStatus: AnimalDueDateStatus | null;
      dueDateBreedingRecordId: string | null;
    } => {
      const normalizedSex = sex.trim().toLowerCase();
      if (normalizedSex !== "cow" && normalizedSex !== "female") {
        return { dueDate: null, dueDateStatus: null, dueDateBreedingRecordId: null };
      }

      const breedingDates = breedingDatesByAnimalId.get(animalId) ?? [];
      const calvingDates = calvingDatesByDamId.get(animalId) ?? [];

      for (const breedingDate of breedingDates) {
        const exposureTime = breedingDate.firstExposureDate.getTime();
        const hasLaterCalving = calvingDates.some(
          (calvingDate) => calvingDate.getTime() > exposureTime,
        );
        if (hasLaterCalving) continue;

        const dueDate = addDateOnlyDays(breedingDate.firstExposureDate, 283);
        const normalThrough = addDateOnlyMonths(dueDate, 2);
        const displayThrough = addDateOnlyMonths(dueDate, 6);

        if (today.getTime() > displayThrough.getTime()) {
          return { dueDate: null, dueDateStatus: null, dueDateBreedingRecordId: null };
        }

        return {
          dueDate: formatDateOnly(dueDate),
          dueDateStatus:
            today.getTime() > normalThrough.getTime() ? "overdue-struck" : "normal",
          dueDateBreedingRecordId: breedingDate.id,
        };
      }

      return { dueDate: null, dueDateStatus: null, dueDateBreedingRecordId: null };
    };

    return result.map((animal) => ({
      ...(animal as any),
      tags: (animal as any).tags ?? [],
      polled: normalizePolledStatus((animal as any).polled),
      ...getDueDateInfo(animal.id, animal.sex),
    })) as AnimalListItem[];
  }

  async getAnimalById(id: string): Promise<Animal | undefined> {
    const [animal] = await db.select().from(animals).where(eq(animals.id, id));
    return animal
      ? ({ ...(animal as any), polled: normalizePolledStatus((animal as any).polled), tags: (animal as any).tags ?? [] } as Animal)
      : undefined;
  }

  async updateAnimal(id: string, animal: Partial<InsertAnimal>): Promise<Animal | undefined> {
    const updateData: Partial<InsertAnimal> = { ...(animal as any) };
    if (Object.prototype.hasOwnProperty.call(animal, "polled")) {
      updateData.polled = normalizePolledStatus((animal as any).polled);
    }
    if (Object.prototype.hasOwnProperty.call(animal, "tags") && Array.isArray((animal as any).tags)) {
      updateData.tags = (animal as any).tags;
    }

    await db.update(animals).set(updateData).where(eq(animals.id, id));
    const [updated] = await db.select().from(animals).where(eq(animals.id, id));
    return updated
      ? ({ ...(updated as any), polled: normalizePolledStatus((updated as any).polled), tags: (updated as any).tags ?? [] } as Animal)
      : undefined;
  }

  async deleteAnimal(id: string): Promise<void> {
    await db.delete(animals).where(eq(animals.id, id));
  }

  async getAnimalsReadyToBreed(): Promise<Animal[]> {
    const fiftySevenDaysAgo = new Date();
    fiftySevenDaysAgo.setDate(fiftySevenDaysAgo.getDate() - 57);
    const dateString = fiftySevenDaysAgo.toISOString().split("T")[0];

    const result = await db
      .select({
      id: animals.id,
      tagNumber: animals.tagNumber,
      type: animals.type,
      sex: animals.sex,
      dateOfBirth: animals.dateOfBirth,
        sireId: animals.sireId,
        damId: animals.damId,
        currentFieldId: animals.currentFieldId,
        herdName: animals.herdName,
        createdAt: animals.createdAt,
        phenotype: animals.phenotype,
        organic: animals.organic,
        polled: animals.polled,
        tags: animals.tags,
        betacasein: animals.betacasein,
      })
      .from(animals)
      .leftJoin(calvingRecords, eq(animals.id, calvingRecords.damId))
      .where(
        and(
          eq(animals.sex, "Female"),
          sql`${calvingRecords.calvingDate} <= ${dateString}`,
        ),
      )
      .groupBy(animals.id);

    return result.map((animal) => ({
      ...(animal as any),
      polled: normalizePolledStatus((animal as any).polled),
      tags: (animal as any).tags ?? [],
    })) as Animal[];
  }

  async getOffspringByParentId(parentId: string): Promise<Animal[]> {
    const result = await db
      .select({
      id: animals.id,
      tagNumber: animals.tagNumber,
      type: animals.type,
      sex: animals.sex,
      dateOfBirth: animals.dateOfBirth,
        sireId: animals.sireId,
        damId: animals.damId,
        currentFieldId: animals.currentFieldId,
        herdName: animals.herdName,
        createdAt: animals.createdAt,
        phenotype: animals.phenotype,
        organic: animals.organic,
        polled: animals.polled,
        tags: animals.tags,
        betacasein: animals.betacasein,
        currentFieldName: fields.name,
      })
      .from(animals)
      .leftJoin(fields, eq(animals.currentFieldId, fields.id))
      .where(or(eq(animals.sireId, parentId), eq(animals.damId, parentId)));

    return result.map((animal) => ({
      ...(animal as any),
      polled: normalizePolledStatus((animal as any).polled),
    })) as Animal[];
  }

  // ---------- Livestock Lots ----------

  async createLivestockLot(lot: InsertLivestockLot): Promise<LivestockLot> {
    const id = crypto.randomUUID();
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(livestockLots).values({
        ...(lot as any),
        id,
        updatedAt: now,
      });

      await tx.insert(livestockLotCountEvents).values({
        id: crypto.randomUUID(),
        lotId: id,
        eventType: "created",
        eventDate: formatDateOnly(getTodayDateOnly()) as any,
        ewesDelta: lot.ewes,
        ramsDelta: lot.rams,
        lambsDelta: lot.lambs,
        wethersDelta: lot.wethers,
        unknownDelta: lot.unknown,
        notes: lot.notes ?? null,
      });
    });

    const [created] = await db.select().from(livestockLots).where(eq(livestockLots.id, id));
    return created as LivestockLot;
  }

  async getAllLivestockLots(): Promise<LivestockLotListItem[]> {
    try {
      const result = await db
        .select({
          id: livestockLots.id,
          name: livestockLots.name,
          species: livestockLots.species,
          status: livestockLots.status,
          currentFieldId: livestockLots.currentFieldId,
          ewes: livestockLots.ewes,
          rams: livestockLots.rams,
          lambs: livestockLots.lambs,
          wethers: livestockLots.wethers,
          unknown: livestockLots.unknown,
          notes: livestockLots.notes,
          createdAt: livestockLots.createdAt,
          updatedAt: livestockLots.updatedAt,
          currentFieldName: fields.name,
          propertyName: properties.name,
        })
        .from(livestockLots)
        .leftJoin(fields, eq(livestockLots.currentFieldId, fields.id))
        .leftJoin(properties, eq(fields.propertyId, properties.id))
        .orderBy(livestockLots.name);

      return result.map((lot) => toLotListItem(lot as any));
    } catch (error: any) {
      if (isMissingLivestockTableError(error)) return [];
      throw error;
    }
  }

  async getLivestockLotById(id: string): Promise<LivestockLotListItem | undefined> {
    const [lot] = await db
      .select({
        id: livestockLots.id,
        name: livestockLots.name,
        species: livestockLots.species,
        status: livestockLots.status,
        currentFieldId: livestockLots.currentFieldId,
        ewes: livestockLots.ewes,
        rams: livestockLots.rams,
        lambs: livestockLots.lambs,
        wethers: livestockLots.wethers,
        unknown: livestockLots.unknown,
        notes: livestockLots.notes,
        createdAt: livestockLots.createdAt,
        updatedAt: livestockLots.updatedAt,
        currentFieldName: fields.name,
        propertyName: properties.name,
      })
      .from(livestockLots)
      .leftJoin(fields, eq(livestockLots.currentFieldId, fields.id))
      .leftJoin(properties, eq(fields.propertyId, properties.id))
      .where(eq(livestockLots.id, id));

    return lot ? toLotListItem(lot as any) : undefined;
  }

  async updateLivestockLot(id: string, lot: UpdateLivestockLot): Promise<LivestockLot | undefined> {
    const existing = await this.getLivestockLotById(id);
    if (!existing) return undefined;

    const updateData: Record<string, unknown> = { ...(lot as any), updatedAt: new Date() };
    const nextCounts = {
      ...getLotCounts(existing),
      ...Object.fromEntries(
        lotCountKeys
          .filter((key) => Object.prototype.hasOwnProperty.call(lot, key))
          .map((key) => [key, Number((lot as any)[key] ?? 0)]),
      ),
    } as LotCounts;
    ensureNonNegativeLotCounts(nextCounts);
    if (getLotTotal(nextCounts) <= 0) {
      throw new Error("A lot must contain at least one animal.");
    }

    await db.update(livestockLots).set(updateData as any).where(eq(livestockLots.id, id));
    const [updated] = await db.select().from(livestockLots).where(eq(livestockLots.id, id));
    return updated as LivestockLot | undefined;
  }

  async deleteLivestockLot(id: string): Promise<void> {
    await db.delete(livestockLots).where(eq(livestockLots.id, id));
  }

  async createLivestockLotCountEvent(
    lotId: string,
    event: InsertLivestockLotCountEvent,
  ): Promise<LivestockLotCountEvent> {
    const lot = await this.getLivestockLotById(lotId);
    if (!lot) throw new Error("Lot not found");

    const nextCounts: LotCounts = {
      ewes: lot.ewes + event.ewesDelta,
      rams: lot.rams + event.ramsDelta,
      lambs: lot.lambs + event.lambsDelta,
      wethers: lot.wethers + event.wethersDelta,
      unknown: lot.unknown + event.unknownDelta,
    };
    ensureNonNegativeLotCounts(nextCounts);

    const id = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.update(livestockLots)
        .set({
          ...nextCounts,
          status: getLotTotal(nextCounts) === 0 ? "inactive" : lot.status,
          updatedAt: new Date(),
        } as any)
        .where(eq(livestockLots.id, lotId));

      await tx.insert(livestockLotCountEvents).values({
        ...(event as any),
        id,
        lotId,
      });
    });

    const [created] = await db
      .select()
      .from(livestockLotCountEvents)
      .where(eq(livestockLotCountEvents.id, id));
    return created as LivestockLotCountEvent;
  }

  async getLivestockLotCountEvents(lotId: string): Promise<LivestockLotCountEvent[]> {
    return await db
      .select()
      .from(livestockLotCountEvents)
      .where(eq(livestockLotCountEvents.lotId, lotId))
      .orderBy(desc(livestockLotCountEvents.eventDate), desc(livestockLotCountEvents.createdAt));
  }

  async moveLivestockLot(lotId: string, movement: MoveLivestockLotInput): Promise<LivestockLotMovement> {
    const source = await this.getLivestockLotById(lotId);
    if (!source) throw new Error("Lot not found");

    const field = await this.getFieldById(movement.toFieldId);
    if (!field) throw new Error("Invalid destination field");

    const movedCounts = getMoveCounts(movement, source);
    if (getLotTotal(movedCounts) <= 0) {
      throw new Error("Move must include at least one animal.");
    }

    const remainingCounts = subtractLotCounts(source, movedCounts);
    ensureNonNegativeLotCounts(remainingCounts);

    const sourceCounts = getLotCounts(source);
    const isWholeLotMove =
      lotCountKeys.every((key) => movedCounts[key] === sourceCounts[key]);
    const movementId = crypto.randomUUID();
    let destinationLotId = movement.destinationLotId ?? null;

    await db.transaction(async (tx) => {
      if (isWholeLotMove) {
        destinationLotId = null;
        await tx.update(livestockLots)
          .set({ currentFieldId: movement.toFieldId, updatedAt: new Date() } as any)
          .where(eq(livestockLots.id, lotId));
      } else {
        let destinationLot: LivestockLot | undefined;
        if (destinationLotId) {
          const [existingDestination] = await tx
            .select()
            .from(livestockLots)
            .where(eq(livestockLots.id, destinationLotId));
          destinationLot = existingDestination as LivestockLot | undefined;
          if (!destinationLot) throw new Error("Destination lot not found");
          if (destinationLot.species !== source.species) {
            throw new Error("Destination lot must use the same species.");
          }
          const destinationCounts = addLotCounts(destinationLot, movedCounts);
          await tx.update(livestockLots)
            .set({
              ...destinationCounts,
              currentFieldId: movement.toFieldId,
              status: "active",
              updatedAt: new Date(),
            } as any)
            .where(eq(livestockLots.id, destinationLot.id));
        } else {
          destinationLotId = crypto.randomUUID();
          await tx.insert(livestockLots).values({
            id: destinationLotId,
            name: movement.destinationLotName || `${source.name} split`,
            species: source.species,
            status: "active",
            currentFieldId: movement.toFieldId,
            ...movedCounts,
            notes: movement.notes ?? null,
            updatedAt: new Date(),
          } as any);
        }

        await tx.update(livestockLots)
          .set({
            ...remainingCounts,
            status: getLotTotal(remainingCounts) === 0 ? "inactive" : source.status,
            currentFieldId: getLotTotal(remainingCounts) === 0 ? null : source.currentFieldId,
            updatedAt: new Date(),
          } as any)
          .where(eq(livestockLots.id, lotId));

        const eventDate = formatDateOnly(parseDateOnly(movement.movementDate) ?? getTodayDateOnly());
        await tx.insert(livestockLotCountEvents).values([
          {
            id: crypto.randomUUID(),
            lotId,
            eventType: "split",
            eventDate: eventDate as any,
            ewesDelta: -movedCounts.ewes,
            ramsDelta: -movedCounts.rams,
            lambsDelta: -movedCounts.lambs,
            wethersDelta: -movedCounts.wethers,
            unknownDelta: -movedCounts.unknown,
            relatedLotId: destinationLotId,
            notes: movement.notes ?? null,
          },
          {
            id: crypto.randomUUID(),
            lotId: destinationLotId,
            eventType: "split",
            eventDate: eventDate as any,
            ewesDelta: movedCounts.ewes,
            ramsDelta: movedCounts.rams,
            lambsDelta: movedCounts.lambs,
            wethersDelta: movedCounts.wethers,
            unknownDelta: movedCounts.unknown,
            relatedLotId: lotId,
            notes: movement.notes ?? null,
          },
        ] as any);
      }

      await tx.insert(livestockLotMovements).values({
        id: movementId,
        lotId,
        destinationLotId,
        fromFieldId: source.currentFieldId,
        toFieldId: movement.toFieldId,
        movementDate: movement.movementDate,
        ewesMoved: movedCounts.ewes,
        ramsMoved: movedCounts.rams,
        lambsMoved: movedCounts.lambs,
        wethersMoved: movedCounts.wethers,
        unknownMoved: movedCounts.unknown,
        notes: movement.notes ?? null,
      });
    });

    const [created] = await db
      .select()
      .from(livestockLotMovements)
      .where(eq(livestockLotMovements.id, movementId));
    return created as LivestockLotMovement;
  }

  async getRecentLivestockMovements(limit: number = 10): Promise<LivestockRecentMovement[]> {
    const fromFields = alias(fields, "lot_from_fields");
    const toFields = alias(fields, "lot_to_fields");

    const animalMoves = await this.getRecentMovements(limit);
    let lotMoves: any[] = [];
    try {
      lotMoves = await db
        .select({
          id: livestockLotMovements.id,
          movementDate: livestockLotMovements.movementDate,
          notes: livestockLotMovements.notes,
          lotName: livestockLots.name,
          species: livestockLots.species,
          fromFieldName: fromFields.name,
          toFieldName: toFields.name,
          ewesMoved: livestockLotMovements.ewesMoved,
          ramsMoved: livestockLotMovements.ramsMoved,
          lambsMoved: livestockLotMovements.lambsMoved,
          wethersMoved: livestockLotMovements.wethersMoved,
          unknownMoved: livestockLotMovements.unknownMoved,
        })
        .from(livestockLotMovements)
        .leftJoin(livestockLots, eq(livestockLotMovements.lotId, livestockLots.id))
        .leftJoin(fromFields, eq(livestockLotMovements.fromFieldId, fromFields.id))
        .leftJoin(toFields, eq(livestockLotMovements.toFieldId, toFields.id))
        .orderBy(desc(livestockLotMovements.movementDate))
        .limit(limit);
    } catch (error: any) {
      if (!isMissingLivestockTableError(error)) throw error;
    }

    const combined: LivestockRecentMovement[] = [
      ...animalMoves.map((movement: any) => ({
        id: movement.id,
        movementKind: "animal" as const,
        movementDate: movement.movementDate,
        notes: movement.notes,
        fromFieldName: movement.fromFieldName,
        toFieldName: movement.toFieldName,
        tagNumber: movement.tagNumber,
      })),
      ...lotMoves.map((movement) => ({
        ...(movement as any),
        movementKind: "lot" as const,
      })),
    ];

    return combined
      .sort((a, b) => new Date(b.movementDate as any).getTime() - new Date(a.movementDate as any).getTime())
      .slice(0, limit);
  }

  async getLivestockSpeciesSettings(species?: string): Promise<LivestockSpeciesSettings[]> {
    try {
      if (!species || species === "sheep") {
        const [sheep] = await db
          .select()
          .from(livestockSpeciesSettings)
          .where(eq(livestockSpeciesSettings.species, "sheep"));
        if (!sheep) {
          await this.upsertLivestockSpeciesSettings(defaultSheepSettings);
        }
      }

      const query = db.select().from(livestockSpeciesSettings);
      const rows = species
        ? await query.where(eq(livestockSpeciesSettings.species, species))
        : await query.orderBy(livestockSpeciesSettings.displayName);
      return rows as LivestockSpeciesSettings[];
    } catch (error: any) {
      if (isMissingLivestockTableError(error) && (!species || species === "sheep")) {
        return [{
          id: "default-sheep-settings",
          ...defaultSheepSettings,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as LivestockSpeciesSettings];
      }
      if (isMissingLivestockTableError(error)) return [];
      throw error;
    }
  }

  async upsertLivestockSpeciesSettings(
    settings: UpsertLivestockSpeciesSettings,
  ): Promise<LivestockSpeciesSettings> {
    const [existing] = await db
      .select()
      .from(livestockSpeciesSettings)
      .where(eq(livestockSpeciesSettings.species, settings.species));

    if (existing) {
      await db
        .update(livestockSpeciesSettings)
        .set({ ...(settings as any), updatedAt: new Date() })
        .where(eq(livestockSpeciesSettings.id, existing.id));
      const [updated] = await db
        .select()
        .from(livestockSpeciesSettings)
        .where(eq(livestockSpeciesSettings.id, existing.id));
      return updated as LivestockSpeciesSettings;
    }

    const id = crypto.randomUUID();
    await db.insert(livestockSpeciesSettings).values({
      ...(settings as any),
      id,
      updatedAt: new Date(),
    });
    const [created] = await db
      .select()
      .from(livestockSpeciesSettings)
      .where(eq(livestockSpeciesSettings.id, id));
    return created as LivestockSpeciesSettings;
  }

  // ---------- Properties ----------

  async createProperty(property: InsertProperty): Promise<Property> {
    const id = crypto.randomUUID();
    await db.insert(properties).values({ ...(property as any), id });
    const [created] = await db.select().from(properties).where(eq(properties.id, id));
    return created as Property;
  }

  async getAllProperties(): Promise<Property[]> {
    return await db.select().from(properties);
  }

  async getPropertyById(id: string): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property;
  }

  async updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property | undefined> {
    await db.update(properties).set(property).where(eq(properties.id, id));
    const [updated] = await db.select().from(properties).where(eq(properties.id, id));
    return updated;
  }

  async deleteProperty(id: string): Promise<void> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(animals)
      .innerJoin(fields, eq(animals.currentFieldId, fields.id))
      .where(eq(fields.propertyId, id));

    if (count > 0) {
      throw new Error("You must remove animals from this property before deleting it.");
    }

    const propertyFields = await db
      .select({ id: fields.id })
      .from(fields)
      .where(eq(fields.propertyId, id));
    const fieldIds = propertyFields.map((field) => field.id);

    if (fieldIds.length > 0) {
      await db.delete(hayRecords).where(inArray(hayRecords.fieldId, fieldIds));
      await db
        .delete(fieldAmendmentRecords)
        .where(inArray(fieldAmendmentRecords.fieldId, fieldIds));
      await db
        .update(movements)
        .set({ fromFieldId: null })
        .where(inArray(movements.fromFieldId, fieldIds));
      await db.delete(movements).where(inArray(movements.toFieldId, fieldIds));
      await db.delete(fields).where(eq(fields.propertyId, id));
    }

    await db.delete(properties).where(eq(properties.id, id));
  }

  // ---------- Fields ----------

  async createField(field: InsertField): Promise<Field> {
    const id = crypto.randomUUID();
    await db.insert(fields).values({ ...(field as any), id });
    const [created] = await db.select().from(fields).where(eq(fields.id, id));
    return created as Field;
  }

  async getAllFields(): Promise<Field[]> {
    return await db.select().from(fields);
  }

  async getFieldById(id: string): Promise<Field | undefined> {
    const [field] = await db.select().from(fields).where(eq(fields.id, id));
    return field;
  }

  async getFieldsByPropertyId(propertyId: string): Promise<Field[]> {
    return await db.select().from(fields).where(eq(fields.propertyId, propertyId));
  }

  async updateField(id: string, field: Partial<InsertField>): Promise<Field | undefined> {
    await db.update(fields).set(field).where(eq(fields.id, id));
    const [updated] = await db.select().from(fields).where(eq(fields.id, id));
    return updated;
  }

  async deleteField(id: string): Promise<void> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(animals)
      .where(eq(animals.currentFieldId, id));

    if (count > 0) {
      throw new Error("You must remove animals from this field before deleting it.");
    }

    await db
      .update(movements)
      .set({ fromFieldId: null })
      .where(eq(movements.fromFieldId, id));
    await db.delete(movements).where(eq(movements.toFieldId, id));
    await db.delete(hayRecords).where(eq(hayRecords.fieldId, id));
    await db.delete(fieldAmendmentRecords).where(eq(fieldAmendmentRecords.fieldId, id));
    await db.delete(fields).where(eq(fields.id, id));
  }

  async createHayRecord(record: InsertHayRecord): Promise<HayRecordWithMetrics> {
    const id = crypto.randomUUID();
    await db.insert(hayRecords).values({ ...(record as any), id });
    const [created] = await db.select().from(hayRecords).where(eq(hayRecords.id, id));
    return withHayMetrics(created as HayRecord);
  }

  async getHayRecordById(id: string): Promise<HayRecord | undefined> {
    const [record] = await db.select().from(hayRecords).where(eq(hayRecords.id, id));
    return record as HayRecord | undefined;
  }

  async getHayRecordsByFieldId(fieldId: string): Promise<HayRecordWithMetrics[]> {
    const records = await db
      .select()
      .from(hayRecords)
      .where(eq(hayRecords.fieldId, fieldId))
      .orderBy(desc(hayRecords.balingDate), desc(hayRecords.createdAt));
    return records.map((record) => withHayMetrics(record as HayRecord));
  }

  async updateHayRecord(
    id: string,
    record: InsertHayRecord,
  ): Promise<HayRecordWithMetrics | undefined> {
    await db.update(hayRecords).set(record as any).where(eq(hayRecords.id, id));
    const [updated] = await db.select().from(hayRecords).where(eq(hayRecords.id, id));
    return updated ? withHayMetrics(updated as HayRecord) : undefined;
  }

  async deleteHayRecord(id: string): Promise<void> {
    await db.delete(hayRecords).where(eq(hayRecords.id, id));
  }

  async getHayRecordSummaries(year: number): Promise<FieldHaySummary[]> {
    const recordRows = await db
      .select()
      .from(hayRecords)
      .where(sql`year(${hayRecords.balingDate}) = ${year}`);
    const fieldRows = await db.select().from(fields);
    const fieldAcres = new Map(fieldRows.map((field) => [field.id, toFiniteNumber(field.acres)]));
    const summaries = new Map<
      string,
      { cutCount: number; dryHayBales: number; balageBales: number; totalDmTons: number }
    >();

    recordRows.forEach((record) => {
      const withMetrics = withHayMetrics(record as HayRecord);
      const existing = summaries.get(withMetrics.fieldId) ?? {
        cutCount: 0,
        dryHayBales: 0,
        balageBales: 0,
        totalDmTons: 0,
      };
      existing.cutCount += 1;
      if (withMetrics.hayType === "dry_hay") {
        existing.dryHayBales += toFiniteNumber(withMetrics.baleCount);
      } else if (withMetrics.hayType === "balage") {
        existing.balageBales += toFiniteNumber(withMetrics.baleCount);
      }
      existing.totalDmTons += withMetrics.totalDmTons;
      summaries.set(withMetrics.fieldId, existing);
    });

    return Array.from(summaries.entries()).map(([fieldId, summary]) => {
      const acres = fieldAcres.get(fieldId) ?? 0;
      return {
        fieldId,
        year,
        cutCount: summary.cutCount,
        dryHayBales: summary.dryHayBales,
        balageBales: summary.balageBales,
        totalDmTons: summary.totalDmTons,
        tonDmPerAcre: acres > 0 ? summary.totalDmTons / acres : null,
      };
    });
  }

  async createFieldAmendmentRecord(
    record: InsertFieldAmendmentRecord,
  ): Promise<FieldAmendmentRecord> {
    const id = crypto.randomUUID();
    await db.insert(fieldAmendmentRecords).values({
      ...(cleanFieldAmendmentRecord(record) as any),
      id,
    });
    const [created] = await db
      .select()
      .from(fieldAmendmentRecords)
      .where(eq(fieldAmendmentRecords.id, id));
    return created as FieldAmendmentRecord;
  }

  async getFieldAmendmentRecordById(id: string): Promise<FieldAmendmentRecord | undefined> {
    const [record] = await db
      .select()
      .from(fieldAmendmentRecords)
      .where(eq(fieldAmendmentRecords.id, id));
    return record as FieldAmendmentRecord | undefined;
  }

  async getFieldAmendmentRecordsByFieldId(fieldId: string): Promise<FieldAmendmentRecord[]> {
    return (await db
      .select()
      .from(fieldAmendmentRecords)
      .where(eq(fieldAmendmentRecords.fieldId, fieldId))
      .orderBy(desc(fieldAmendmentRecords.applicationDate), desc(fieldAmendmentRecords.createdAt))) as FieldAmendmentRecord[];
  }

  async updateFieldAmendmentRecord(
    id: string,
    record: InsertFieldAmendmentRecord,
  ): Promise<FieldAmendmentRecord | undefined> {
    await db
      .update(fieldAmendmentRecords)
      .set(cleanFieldAmendmentRecord(record) as any)
      .where(eq(fieldAmendmentRecords.id, id));
    const [updated] = await db
      .select()
      .from(fieldAmendmentRecords)
      .where(eq(fieldAmendmentRecords.id, id));
    return updated as FieldAmendmentRecord | undefined;
  }

  async deleteFieldAmendmentRecord(id: string): Promise<void> {
    await db.delete(fieldAmendmentRecords).where(eq(fieldAmendmentRecords.id, id));
  }

  async getCurrentAnimalCountByField(): Promise<LivestockInventoryByField[]> {
    const [fieldRows, animalRows] = await Promise.all([
      db
        .select({
          property: properties.name,
          field: fields.name,
          fieldId: fields.id,
        })
        .from(fields)
        .innerJoin(properties, eq(fields.propertyId, properties.id)),
      db
        .select({
          currentFieldId: animals.currentFieldId,
          type: animals.type,
        })
        .from(animals)
        .where(sql`${animals.currentFieldId} is not null and (${animals.status} = 'active' or ${animals.status} is null)`),
    ]);

    let lotRows: {
      currentFieldId: string | null;
      species: string;
      ewes: number;
      rams: number;
      lambs: number;
      wethers: number;
      unknown: number;
    }[] = [];

    try {
      lotRows = await db
        .select({
          currentFieldId: livestockLots.currentFieldId,
          species: livestockLots.species,
          ewes: livestockLots.ewes,
          rams: livestockLots.rams,
          lambs: livestockLots.lambs,
          wethers: livestockLots.wethers,
          unknown: livestockLots.unknown,
        })
        .from(livestockLots)
        .where(sql`${livestockLots.currentFieldId} is not null and ${livestockLots.status} = 'active'`);
    } catch (error: any) {
      if (!isMissingLivestockTableError(error)) throw error;
    }

    const fieldMeta = new Map(fieldRows.map((field) => [field.fieldId, field]));
    const byField = new Map<string, LivestockInventoryByField>();

    const ensureRow = (fieldId: string) => {
      const existing = byField.get(fieldId);
      if (existing) return existing;
      const meta = fieldMeta.get(fieldId);
      const row: LivestockInventoryByField = {
        property: meta?.property ?? "Unknown property",
        field: meta?.field ?? "Unknown field",
        fieldId,
        dairy: 0,
        beef: 0,
        ai: 0,
        sheepEwes: 0,
        sheepRams: 0,
        sheepLambs: 0,
        sheepWethers: 0,
        sheepUnknown: 0,
        sheepTotal: 0,
      };
      byField.set(fieldId, row);
      return row;
    };

    for (const animal of animalRows) {
      if (!animal.currentFieldId) continue;
      const row = ensureRow(animal.currentFieldId);
      const normalizedType = String(animal.type ?? "").trim().toLowerCase();
      if (normalizedType === "dairy") row.dairy += 1;
      else if (normalizedType === "beef") row.beef += 1;
      else if (normalizedType === "ai") row.ai += 1;
    }

    for (const lot of lotRows) {
      if (!lot.currentFieldId) continue;
      const row = ensureRow(lot.currentFieldId);
      if (String(lot.species).trim().toLowerCase() === "sheep") {
        row.sheepEwes += Number(lot.ewes || 0);
        row.sheepRams += Number(lot.rams || 0);
        row.sheepLambs += Number(lot.lambs || 0);
        row.sheepWethers += Number(lot.wethers || 0);
        row.sheepUnknown += Number(lot.unknown || 0);
        row.sheepTotal += getLotTotal(lot as any);
      }
    }

    return Array.from(byField.values()).sort((a, b) => {
      if (a.property !== b.property) return a.property.localeCompare(b.property);
      return a.field.localeCompare(b.field);
    });
  }

  // ---------- Movements ----------

  async createMovement(movement: InsertMovement): Promise<Movement> {
    const id = crypto.randomUUID();
    await db.insert(movements).values({ ...(movement as any), id });

    if (movement.toFieldId) {
      await db
        .update(animals)
        .set({ currentFieldId: movement.toFieldId })
        .where(eq(animals.id, movement.animalId));
    }

    const [created] = await db.select().from(movements).where(eq(movements.id, id));
    return created as Movement;
  }

  async getAllMovements(): Promise<Movement[]> {
    return await db.select().from(movements).orderBy(movements.movementDate);
  }

  async getMovementsByAnimalId(animalId: string): Promise<Movement[]> {
    const fromFields = alias(fields, "from_fields");
    const toFields = alias(fields, "to_fields");

    const result = await db
      .select({
        id: movements.id,
        createdAt: movements.createdAt,
        animalId: movements.animalId,
        fromFieldId: movements.fromFieldId,
        toFieldId: movements.toFieldId,
        movementDate: movements.movementDate,
        notes: movements.notes,
        fromFieldName: fromFields.name,
        toFieldName: toFields.name,
      })
      .from(movements)
      .leftJoin(fromFields, eq(movements.fromFieldId, fromFields.id))
      .leftJoin(toFields, eq(movements.toFieldId, toFields.id))
      .where(eq(movements.animalId, animalId))
      .orderBy(desc(movements.movementDate));

    return result as Movement[];
  }

  async getRecentMovements(limit: number = 10): Promise<Movement[]> {
    const fromFields = alias(fields, "from_fields");
    const toFields = alias(fields, "to_fields");

    const result = await db
      .select({
        id: movements.id,
        createdAt: movements.createdAt,
        animalId: movements.animalId,
        fromFieldId: movements.fromFieldId,
        toFieldId: movements.toFieldId,
        movementDate: movements.movementDate,
        notes: movements.notes,
        tagNumber: animals.tagNumber,
        fromFieldName: fromFields.name,
        toFieldName: toFields.name,
      })
      .from(movements)
      .leftJoin(animals, eq(movements.animalId, animals.id))
      .leftJoin(fromFields, eq(movements.fromFieldId, fromFields.id))
      .leftJoin(toFields, eq(movements.toFieldId, toFields.id))
      .orderBy(desc(movements.movementDate))
      .limit(limit);

    return result as Movement[];
  }

  // ---------- Vaccinations ----------

  async createVaccination(vaccination: InsertVaccination): Promise<Vaccination> {
    const id = crypto.randomUUID();
    await db.insert(vaccinations).values({ ...(vaccination as any), id });
    const [created] = await db.select().from(vaccinations).where(eq(vaccinations.id, id));
    return created as Vaccination;
  }

  async getVaccinationsByAnimalId(animalId: string): Promise<Vaccination[]> {
    return await db
      .select()
      .from(vaccinations)
      .where(eq(vaccinations.animalId, animalId))
      .orderBy(desc(vaccinations.administeredDate));
  }

  async updateVaccination(
    id: string,
    vaccination: Partial<InsertVaccination>,
  ): Promise<Vaccination | undefined> {
    await db.update(vaccinations).set(vaccination).where(eq(vaccinations.id, id));
    const [updated] = await db.select().from(vaccinations).where(eq(vaccinations.id, id));
    return updated;
  }

  async deleteVaccination(id: string): Promise<void> {
    await db.delete(vaccinations).where(eq(vaccinations.id, id));
  }

  // ---------- Events ----------

  async createEvent(event: InsertEvent): Promise<Event> {
    const id = crypto.randomUUID();
    await db.insert(events).values({ ...(event as any), id });
    const [created] = await db.select().from(events).where(eq(events.id, id));
    return created as Event;
  }

  async getEventsByAnimalId(animalId: string): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .where(eq(events.animalId, animalId))
      .orderBy(desc(events.eventDate));
  }

  async updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined> {
    await db.update(events).set(event).where(eq(events.id, id));
    const [updated] = await db.select().from(events).where(eq(events.id, id));
    return updated;
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  // ---------- Calving Records ----------

  async createCalvingRecord(record: InsertCalvingRecord): Promise<CalvingRecord> {
    const id = crypto.randomUUID();
    await db.insert(calvingRecords).values({ ...(record as any), id });
    const [created] = await db.select().from(calvingRecords).where(eq(calvingRecords.id, id));
    return created as CalvingRecord;
  }

  async getCalvingRecordsByDamId(damId: string): Promise<CalvingRecord[]> {
    return await db
      .select()
      .from(calvingRecords)
      .where(eq(calvingRecords.damId, damId))
      .orderBy(desc(calvingRecords.calvingDate));
  }

  async updateCalvingRecord(
    id: string,
    record: Partial<InsertCalvingRecord>,
  ): Promise<CalvingRecord | undefined> {
    await db.update(calvingRecords).set(record).where(eq(calvingRecords.id, id));
    const [updated] = await db.select().from(calvingRecords).where(eq(calvingRecords.id, id));
    return updated;
  }

  async deleteCalvingRecord(id: string): Promise<void> {
    await db.delete(calvingRecords).where(eq(calvingRecords.id, id));
  }

  // ---------- Slaughter/Sold Records ----------

  async createSlaughterRecord(record: InsertSlaughterRecord): Promise<SlaughterRecord> {
    const id = crypto.randomUUID();
    const recordType = resolveSlaughterRecordType(
      (record as any).recordType,
      "slaughtered",
      Boolean((record as any).buyer || (record as any).pricePerLb),
    );

    // Compute ageMonths on backend if not provided
    let ageMonths: number | null = record.ageMonths ?? null;

    if (ageMonths == null && record.animalId && record.slaughterDate) {
      // get animal to read DOB
      const animal = await this.getAnimalById(record.animalId);
      if (animal?.dateOfBirth) {
        const dob = new Date(animal.dateOfBirth as any);
        const slaughter = new Date(record.slaughterDate as any);

        if (!isNaN(dob.getTime()) && !isNaN(slaughter.getTime())) {
          let months =
            (slaughter.getFullYear() - dob.getFullYear()) * 12 +
            (slaughter.getMonth() - dob.getMonth());

          // If slaughter day-of-month is before DOB day-of-month, subtract 1 month
          if (slaughter.getDate() < dob.getDate()) {
            months -= 1;
          }

          if (months < 0) months = 0;
          ageMonths = months;
        }
      }
    }

    try {
      await db.insert(slaughterRecords).values({
        ...(record as any),
        id,
        recordType,
        ageMonths,
        hangingWeight: recordType === "sold" ? null : ((record as any).hangingWeight ?? null),
        processor: recordType === "sold" ? null : ((record as any).processor ?? null),
        buyer: recordType === "sold" ? ((record as any).buyer ?? null) : null,
        pricePerLb: recordType === "sold" ? ((record as any).pricePerLb ?? null) : null,
      });
    } catch (error: any) {
      if (!isMissingSlaughterColumnError(error)) {
        throw error;
      }

      // Legacy schema fallback (without record_type/buyer/price_per_lb columns)
      const legacyProcessor =
        recordType === "sold"
          ? `SOLD:${((record as any).buyer ?? "").toString().trim()}`
          : ((record as any).processor ?? null);
      await pool.query(
        "INSERT INTO slaughter_records (id, animal_id, slaughter_date, age_months, live_weight, hanging_weight, processor) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          record.animalId,
          record.slaughterDate as any,
          ageMonths,
          (record as any).liveWeight ?? null,
          recordType === "sold" ? null : ((record as any).hangingWeight ?? null),
          legacyProcessor,
        ],
      );
    }

    // Mark animal as removed from herd + clear field/herd
    await setAnimalRemovalStatus(record.animalId, recordType);

    const created = await this.getSlaughterRecordById(id);
    if (!created) {
      throw new Error("Unable to load created slaughter/sold record");
    }
    return created;
  }

  async updateSlaughterRecord(
    id: string,
    record: InsertSlaughterRecord,
  ): Promise<SlaughterRecord | undefined> {
    const existing = await this.getSlaughterRecordById(id);
    if (!existing) return undefined;

    const recordType = resolveSlaughterRecordType(
      (record as any).recordType,
      resolveSlaughterRecordType((existing as any).recordType, "slaughtered", Boolean((existing as any).buyer || (existing as any).pricePerLb)),
      Boolean((record as any).buyer || (record as any).pricePerLb),
    );

    let ageMonths: number | null = record.ageMonths ?? null;
    if (ageMonths == null && record.animalId && record.slaughterDate) {
      const animal = await this.getAnimalById(record.animalId);
      if (animal?.dateOfBirth) {
        const dob = new Date(animal.dateOfBirth as any);
        const slaughter = new Date(record.slaughterDate as any);
        if (!isNaN(dob.getTime()) && !isNaN(slaughter.getTime())) {
          let months =
            (slaughter.getFullYear() - dob.getFullYear()) * 12 +
            (slaughter.getMonth() - dob.getMonth());
          if (slaughter.getDate() < dob.getDate()) {
            months -= 1;
          }
          if (months < 0) months = 0;
          ageMonths = months;
        }
      }
    }

    try {
      await db
        .update(slaughterRecords)
        .set({
          ...(record as any),
          recordType,
          ageMonths,
          hangingWeight: recordType === "sold" ? null : ((record as any).hangingWeight ?? null),
          processor: recordType === "sold" ? null : ((record as any).processor ?? null),
          buyer: recordType === "sold" ? ((record as any).buyer ?? null) : null,
          pricePerLb: recordType === "sold" ? ((record as any).pricePerLb ?? null) : null,
        })
        .where(eq(slaughterRecords.id, id));
    } catch (error: any) {
      if (!isMissingSlaughterColumnError(error)) {
        throw error;
      }

      // Legacy schema fallback (without record_type/buyer/price_per_lb columns)
      const legacyProcessor =
        recordType === "sold"
          ? `SOLD:${((record as any).buyer ?? "").toString().trim()}`
          : ((record as any).processor ?? null);
      await pool.query(
        "UPDATE slaughter_records SET animal_id = ?, slaughter_date = ?, age_months = ?, live_weight = ?, hanging_weight = ?, processor = ? WHERE id = ?",
        [
          record.animalId,
          record.slaughterDate as any,
          ageMonths,
          (record as any).liveWeight ?? null,
          recordType === "sold" ? null : ((record as any).hangingWeight ?? null),
          legacyProcessor,
          id,
        ],
      );
    }

    await setAnimalRemovalStatus(record.animalId, recordType);

    const updated = await this.getSlaughterRecordById(id);
    return updated;
  }
 
  async getAllSlaughterRecords(): Promise<SlaughterRecord[]> {
    try {
      const rows = await db.select().from(slaughterRecords).orderBy(desc(slaughterRecords.slaughterDate));
      return rows.map((row) => mapSlaughterRow(row));
    } catch (error: any) {
      if (!isMissingSlaughterColumnError(error)) {
        throw error;
      }

      const [rows] = await pool.query(
        "SELECT id, animal_id, slaughter_date, age_months, live_weight, hanging_weight, processor, created_at FROM slaughter_records ORDER BY slaughter_date DESC",
      );
      return (rows as any[]).map((row) => mapSlaughterRow(row));
    }
  }

  async getSlaughterRecordById(id: string): Promise<SlaughterRecord | undefined> {
    try {
      const [record] = await db.select().from(slaughterRecords).where(eq(slaughterRecords.id, id));
      return record ? mapSlaughterRow(record) : undefined;
    } catch (error: any) {
      if (!isMissingSlaughterColumnError(error)) {
        throw error;
      }

      const [rows] = await pool.query(
        "SELECT id, animal_id, slaughter_date, age_months, live_weight, hanging_weight, processor, created_at FROM slaughter_records WHERE id = ? LIMIT 1",
        [id],
      );
      const first = (rows as any[])[0];
      return first ? mapSlaughterRow(first) : undefined;
    }
  }

  async deleteSlaughterRecord(id: string): Promise<void> {
    await db.delete(slaughterRecords).where(eq(slaughterRecords.id, id));
  }

  // ---------- Notes ----------

  async createNote(note: InsertNote): Promise<Note> {
    const id = crypto.randomUUID();
    await db.insert(notes).values({ ...(note as any), id });
    const [created] = await db.select().from(notes).where(eq(notes.id, id));
    return created as Note;
  }

  async bulkCreateNotes(noteList: InsertNote[]): Promise<Note[]> {
    if (noteList.length === 0) return [];
    const withIds = noteList.map((n) => ({
      ...(n as any),
      id: crypto.randomUUID(),
    }));
    await db.insert(notes).values(withIds);
    return [];
  }

  async getNotesByAnimalId(animalId: string): Promise<Note[]> {
    return await db
      .select()
      .from(notes)
      .where(eq(notes.animalId, animalId))
      .orderBy(desc(notes.noteDate), desc(notes.createdAt));
  }

  async getLatestNotesByAnimal(): Promise<
    { animalId: string; note: string; noteDate: string }[]
  > {
    const result = await db
      .select({
        animalId: notes.animalId,
        note: notes.note,
        noteDate: notes.noteDate,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .orderBy(desc(notes.noteDate), desc(notes.createdAt));

    const latest = new Map<string, { animalId: string; note: string; noteDate: string }>();
    for (const row of result) {
      if (!latest.has(row.animalId)) {
        latest.set(row.animalId, {
          animalId: row.animalId,
          note: row.note,
          noteDate: row.noteDate as any as string,
        });
      }
    }

    return Array.from(latest.values());
  }

  async updateNote(id: string, note: Partial<InsertNote>): Promise<Note | undefined> {
    await db.update(notes).set(note).where(eq(notes.id, id));
    const [updated] = await db.select().from(notes).where(eq(notes.id, id));
    return updated as Note | undefined;
  }

  async deleteNote(id: string): Promise<void> {
    await db.delete(notes).where(eq(notes.id, id));
  }

  // ---------- Breeding Records ----------

  async createBreedingRecord(record: InsertBreedingRecord): Promise<BreedingRecord> {
    const id = crypto.randomUUID();
    await db.insert(breedingRecords).values({ ...(record as any), id });
    const [created] = await db.select().from(breedingRecords).where(eq(breedingRecords.id, id));
    return created as BreedingRecord;
  }

  async getBreedingRecordsByAnimalId(animalId: string): Promise<BreedingRecord[]> {
    return await db
      .select()
      .from(breedingRecords)
      .where(eq(breedingRecords.animalId, animalId))
      .orderBy(desc(breedingRecords.breedingDate), desc(breedingRecords.exposureStartDate), desc(breedingRecords.createdAt));
  }

  async updateBreedingRecord(id: string, record: Partial<InsertBreedingRecord>): Promise<BreedingRecord | undefined> {
    await db.update(breedingRecords).set(record).where(eq(breedingRecords.id, id));
    const [updated] = await db.select().from(breedingRecords).where(eq(breedingRecords.id, id));
    return updated as BreedingRecord | undefined;
  }

  async deleteBreedingRecord(id: string): Promise<void> {
    await db.delete(breedingRecords).where(eq(breedingRecords.id, id));
  }

  // ---------- Bulk Import ----------

  async moveAnimalsToField(
    animalIds: string[],
    fieldId: string,
    options?: { movementDate?: Date; note?: string },
  ): Promise<void> {
    if (animalIds.length === 0) return;
    const movementDate = options?.movementDate ?? new Date();
    const note = options?.note ?? null;

    const currentStates = await db
      .select({
        id: animals.id,
        currentFieldId: animals.currentFieldId,
      })
      .from(animals)
      .where(inArray(animals.id, animalIds));

    await db.transaction(async (tx) => {
      await tx.update(animals).set({ currentFieldId: fieldId }).where(inArray(animals.id, animalIds));

      const movementRows = currentStates.map((animal) => ({
        id: crypto.randomUUID(),
        animalId: animal.id,
        fromFieldId: animal.currentFieldId,
        toFieldId: fieldId,
        movementDate,
        notes: note,
      }));

      if (movementRows.length > 0) {
        await tx.insert(movements).values(movementRows);
      }
    });
  }

  async updateAnimalsTags(animalIds: string[], tags: string[]): Promise<void> {
    if (animalIds.length === 0) return;
    const applyTags = Array.from(new Set(tags.filter(Boolean)));
    if (applyTags.length === 0) return;

    const existing = await db
      .select({ id: animals.id, tags: animals.tags })
      .from(animals)
      .where(inArray(animals.id, animalIds));

    for (const row of existing) {
      const current = Array.isArray((row as any).tags) ? ((row as any).tags as string[]) : [];
      const merged = Array.from(new Set([...current, ...applyTags]));
      await db.update(animals).set({ tags: merged }).where(eq(animals.id, row.id));
    }
  }

  async removeAnimalsTags(animalIds: string[], tags: string[]): Promise<void> {
    if (animalIds.length === 0) return;
    const removeSet = new Set(tags.filter(Boolean));
    if (removeSet.size === 0) return;

    const existing = await db
      .select({ id: animals.id, tags: animals.tags })
      .from(animals)
      .where(inArray(animals.id, animalIds));

    for (const row of existing) {
      const current = Array.isArray((row as any).tags) ? ((row as any).tags as string[]) : [];
      const filtered = current.filter((tag) => !removeSet.has(tag));
      await db.update(animals).set({ tags: filtered }).where(eq(animals.id, row.id));
    }
  }

  async bulkCreateAnimals(animalList: InsertAnimal[]): Promise<Animal[]> {
    if (animalList.length === 0) return [];
    const withIds = animalList.map((a) => ({
      ...(a as any),
      polled: normalizePolledStatus((a as any).polled),
      id: crypto.randomUUID(),
    }));

    try {
      await db.insert(animals).values(withIds);
      return [];
    } catch (err: any) {
      console.error("bulkCreateAnimals DB error:", {
        message: err?.message,
        code: err?.code,
        sql: err?.sql,
      });
      throw err; // let the route handler turn this into a 500
    }
  }

  async bulkCreateProperties(propertyList: InsertProperty[]): Promise<Property[]> {
    if (propertyList.length === 0) return [];
    const withIds = propertyList.map((p) => ({
      ...(p as any),
      id: crypto.randomUUID(),
    }));
    await db.insert(properties).values(withIds);
    return [];
  }

  async bulkCreateFields(fieldList: InsertField[]): Promise<Field[]> {
    if (fieldList.length === 0) return [];
    const withIds = fieldList.map((f) => ({
      ...(f as any),
      id: crypto.randomUUID(),
    }));
    await db.insert(fields).values(withIds);
    return [];
  }

  async bulkCreateVaccinations(vaccinationList: InsertVaccination[]): Promise<Vaccination[]> {
    if (vaccinationList.length === 0) return [];
    const withIds = vaccinationList.map((v) => ({
      ...(v as any),
      id: crypto.randomUUID(),
    }));
    await db.insert(vaccinations).values(withIds);
    return [];
  }

  async bulkCreateEvents(eventList: InsertEvent[]): Promise<Event[]> {
    if (eventList.length === 0) return [];
    const withIds = eventList.map((e) => ({
      ...(e as any),
      id: crypto.randomUUID(),
    }));
    await db.insert(events).values(withIds);
    return [];
  }

  async bulkCreateCalvingRecords(recordList: InsertCalvingRecord[]): Promise<CalvingRecord[]> {
    if (recordList.length === 0) return [];
    const withIds = recordList.map((r) => ({
      ...(r as any),
      id: crypto.randomUUID(),
    }));
    await db.insert(calvingRecords).values(withIds);
    return [];
  }

  async bulkCreateSlaughterRecords(recordList: InsertSlaughterRecord[]): Promise<SlaughterRecord[]> {
    if (recordList.length === 0) return [];
    const withIds = recordList.map((r) => ({
      ...(r as any),
      id: crypto.randomUUID(),
      recordType: resolveSlaughterRecordType(
        (r as any).recordType,
        "slaughtered",
        Boolean((r as any).buyer || (r as any).pricePerLb),
      ),
      hangingWeight:
        resolveSlaughterRecordType(
          (r as any).recordType,
          "slaughtered",
          Boolean((r as any).buyer || (r as any).pricePerLb),
        ) === "sold"
          ? null
          : ((r as any).hangingWeight ?? null),
      processor:
        resolveSlaughterRecordType(
          (r as any).recordType,
          "slaughtered",
          Boolean((r as any).buyer || (r as any).pricePerLb),
        ) === "sold"
          ? null
          : ((r as any).processor ?? null),
      buyer:
        resolveSlaughterRecordType(
          (r as any).recordType,
          "slaughtered",
          Boolean((r as any).buyer || (r as any).pricePerLb),
        ) === "sold"
          ? ((r as any).buyer ?? null)
          : null,
      pricePerLb:
        resolveSlaughterRecordType(
          (r as any).recordType,
          "slaughtered",
          Boolean((r as any).buyer || (r as any).pricePerLb),
        ) === "sold"
          ? ((r as any).pricePerLb ?? null)
          : null,
    }));
    await db.insert(slaughterRecords).values(withIds);

    const soldAnimalIds = Array.from(
      new Set(withIds.filter((r) => r.recordType === "sold").map((r) => r.animalId)),
    );
    const slaughteredAnimalIds = Array.from(
      new Set(withIds.filter((r) => r.recordType !== "sold").map((r) => r.animalId)),
    );

    if (soldAnimalIds.length > 0) {
      try {
        await db
          .update(animals)
          .set({ status: "sold", currentFieldId: null, herdName: null })
          .where(inArray(animals.id, soldAnimalIds));
      } catch (error: any) {
        if (!isStatusEnumError(error)) {
          throw error;
        }
        await db
          .update(animals)
          .set({ status: "slaughtered", currentFieldId: null, herdName: null })
          .where(inArray(animals.id, soldAnimalIds));
      }
    }

    if (slaughteredAnimalIds.length > 0) {
      await db
        .update(animals)
        .set({ status: "slaughtered", currentFieldId: null, herdName: null })
        .where(inArray(animals.id, slaughteredAnimalIds));
    }

    return [];
  }

  // ---------- Lookup helpers ----------

  async getAnimalByTagNumber(tagNumber: string): Promise<Animal | undefined> {
    const [animal] = await db.select().from(animals).where(eq(animals.tagNumber, tagNumber));
    return animal ? ({ ...(animal as any), polled: normalizePolledStatus((animal as any).polled) } as Animal) : undefined;
  }

  async getPropertyByName(name: string): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.name, name));
    return property;
  }

  async getFieldByNameAndProperty(fieldName: string, propertyId: string): Promise<Field | undefined> {
    const [field] = await db
      .select()
      .from(fields)
      .where(and(eq(fields.name, fieldName), eq(fields.propertyId, propertyId)));
    return field;
  }

  // ---------- Users / Auth ----------

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: {
    email: string;
    passwordHash: string;
    firstName?: string;
    lastName?: string;
    isAdmin?: string;
  }): Promise<User> {
    const id = crypto.randomUUID();

    await db.insert(users).values({
      id,
      email: userData.email,
      passwordHash: userData.passwordHash,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      isAdmin: userData.isAdmin || "no",
    });

    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user as User;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUserAdminStatus(id: string, isAdminValue: string): Promise<User | undefined> {
    await db
      .update(users)
      .set({ isAdmin: isAdminValue, updatedAt: new Date() })
      .where(eq(users.id, id));

    return this.getUser(id);
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<User | undefined> {
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id));

    return this.getUser(id);
  }

  async setPasswordResetToken(
    email: string,
    token: string,
    expires: Date,
  ): Promise<User | undefined> {
    await db
      .update(users)
      .set({
        passwordResetToken: token,
        passwordResetExpires: expires,
        updatedAt: new Date(),
      })
      .where(eq(users.email, email));

    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.passwordResetToken, token), gte(users.passwordResetExpires, new Date())));

    return user;
  }

  async clearPasswordResetToken(id: string): Promise<User | undefined> {
    await db
      .update(users)
      .set({
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    return this.getUser(id);
  }
}

export const storage = new DatabaseStorage();
