import { db } from "./db";
import { eq, sql, and, or, gte, desc } from "drizzle-orm";
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
} from "@shared/schema";

console.log("DB check:", typeof (db as any).insert, typeof (db as any).select);

export interface IStorage {
  // Animals
  createAnimal(animal: InsertAnimal): Promise<Animal>;
  getAllAnimals(): Promise<Animal[]>;
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
  getCurrentAnimalCountByField(): Promise<{ property: string; dairy: number; beef: number }[]>;

  // Movements
  createMovement(movement: InsertMovement): Promise<Movement>;
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
  getNotesByAnimalId(animalId: string): Promise<Note[]>;
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

  // Slaughter Records
  createSlaughterRecord(record: InsertSlaughterRecord): Promise<SlaughterRecord>;
  getAllSlaughterRecords(): Promise<SlaughterRecord[]>;
  getSlaughterRecordById(id: string): Promise<SlaughterRecord | undefined>;
  deleteSlaughterRecord(id: string): Promise<void>;

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

    await db.insert(animals).values({
      ...(animal as any),
      id,
    });

    const [created] = await db.select().from(animals).where(eq(animals.id, id));
    return created as Animal;
  }

  async getAllAnimals(): Promise<Animal[]> {
  const sireAnimals = alias(animals, "sire_animals");
  const damAnimals = alias(animals, "dam_animals");

  const result = await db
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
      polled: animals.polled,
      betacasein: animals.betacasein,
      currentFieldName: fields.name,
      sireTagNumber: sireAnimals.tagNumber,
      damTagNumber: damAnimals.tagNumber,
    })
    .from(animals)
    .leftJoin(fields, eq(animals.currentFieldId, fields.id))
    .leftJoin(sireAnimals, eq(animals.sireId, sireAnimals.id))
    .leftJoin(damAnimals, eq(animals.damId, damAnimals.id));

  return result as Animal[];
}

  async getAnimalById(id: string): Promise<Animal | undefined> {
    const [animal] = await db.select().from(animals).where(eq(animals.id, id));
    return animal;
  }

  async updateAnimal(id: string, animal: Partial<InsertAnimal>): Promise<Animal | undefined> {
    await db.update(animals).set(animal).where(eq(animals.id, id));
    const [updated] = await db.select().from(animals).where(eq(animals.id, id));
    return updated;
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
        polled: animals.polled,
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

    return result as Animal[];
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
        polled: animals.polled,
        betacasein: animals.betacasein,
        currentFieldName: fields.name,
      })
      .from(animals)
      .leftJoin(fields, eq(animals.currentFieldId, fields.id))
      .where(or(eq(animals.sireId, parentId), eq(animals.damId, parentId)));

    return result as Animal[];
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

  async getCurrentAnimalCountByField(): Promise<{ property: string; dairy: number; beef: number }[]> {
    const result = await db
      .select({
        property: properties.name,
        dairy: sql<number>`count(case when ${animals.type} = 'dairy' then 1 end)`,
        beef: sql<number>`count(case when ${animals.type} = 'beef' then 1 end)`,
      })
      .from(properties)
      .leftJoin(fields, eq(properties.id, fields.propertyId))
      .leftJoin(animals, eq(fields.id, animals.currentFieldId))
      .groupBy(properties.id, properties.name);

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
        fromFieldName: fromFields.name,
        toFieldName: toFields.name,
      })
      .from(movements)
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

  // ---------- Slaughter Records ----------

    // ---------- Slaughter Records ----------

  async createSlaughterRecord(record: InsertSlaughterRecord): Promise<SlaughterRecord> {
    const id = crypto.randomUUID();

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

    await db.insert(slaughterRecords).values({
      ...(record as any),
      id,
      ageMonths,
    });

    // Mark animal as slaughtered + clear field/herd
  await db
    .update(animals)
    .set({
      status: "slaughtered",
      currentFieldId: null,
      herdName: null,
    })
    .where(eq(animals.id, record.animalId));	

    const [created] = await db
      .select()
      .from(slaughterRecords)
      .where(eq(slaughterRecords.id, id));

    return created as SlaughterRecord;
  }
 
  async getAllSlaughterRecords(): Promise<SlaughterRecord[]> {
    return await db.select().from(slaughterRecords).orderBy(desc(slaughterRecords.slaughterDate));
  }

  async getSlaughterRecordById(id: string): Promise<SlaughterRecord | undefined> {
    const [record] = await db.select().from(slaughterRecords).where(eq(slaughterRecords.id, id));
    return record;
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

  async getNotesByAnimalId(animalId: string): Promise<Note[]> {
    return await db
      .select()
      .from(notes)
      .where(eq(notes.animalId, animalId))
      .orderBy(desc(notes.noteDate), desc(notes.createdAt));
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

  async bulkCreateAnimals(animalList: InsertAnimal[]): Promise<Animal[]> {
    if (animalList.length === 0) return [];
    const withIds = animalList.map((a) => ({
      ...(a as any),
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
    }));
    await db.insert(slaughterRecords).values(withIds);
    return [];
  }

  // ---------- Lookup helpers ----------

  async getAnimalByTagNumber(tagNumber: string): Promise<Animal | undefined> {
    const [animal] = await db.select().from(animals).where(eq(animals.tagNumber, tagNumber));
    return animal;
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
