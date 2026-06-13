import { db, pool } from "./db";
import { eq, sql, and, or, gte, desc, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";

import crypto from "crypto";
import {
  animals,
  properties,
  fields,
  movements,
  vaccinations,
  events,
  calvingRecords,
  slaughterRecords,
  users,
  notes,
  breedingRecords,
  type Animal,
  type AnimalDueDateStatus,
  type AnimalListItem,
  type InsertAnimal,
  type Property,
  type InsertProperty,
  type Field,
  type InsertField,
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
  getCurrentAnimalCountByField(): Promise<{
    property: string;
    field: string;
    fieldId: string;
    dairy: number;
    beef: number;
    ai: number;
  }[]>;

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

    await db.delete(fields).where(eq(fields.id, id));
  }

  async getCurrentAnimalCountByField(): Promise<{
    property: string;
    field: string;
    fieldId: string;
    dairy: number;
    beef: number;
    ai: number;
  }[]> {
    const result = await db
      .select({
        property: properties.name,
        field: fields.name,
        fieldId: fields.id,
        dairy: sql<number>`count(case when ${animals.type} = 'dairy' then 1 end)`,
        beef: sql<number>`count(case when ${animals.type} = 'beef' then 1 end)`,
        ai: sql<number>`count(case when ${animals.type} = 'ai' then 1 end)`,
      })
      .from(fields)
      .innerJoin(properties, eq(fields.propertyId, properties.id))
      .innerJoin(animals, eq(fields.id, animals.currentFieldId))
      .where(sql`(${animals.status} = 'active' or ${animals.status} is null)`)
      .groupBy(fields.id, fields.name, properties.id, properties.name);

    return result;
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
