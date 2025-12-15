import { sql } from "drizzle-orm";
import {
  mysqlTable,
  varchar,
  timestamp,
  int,
  decimal,
  date,
  json,
  index,
  boolean,
  mysqlEnum,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* =========================
 * Helpers for DATE columns
 * ========================= */

const dateOnlyRequired = z
  .union([z.date(), z.string()])
  .transform((val) => {
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10); // YYYY-MM-DD
    }
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (!trimmed) {
        throw new Error("Date is required");
      }
      return trimmed.includes("T") ? trimmed.slice(0, 10) : trimmed;
    }
    throw new Error("Invalid date");
  });

const dateOnlyOptional = z
  .union([z.date(), z.string()])
  .optional()
  .nullable()
  .transform((val) => {
    if (!val) return null;
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (!trimmed) return null;
      return trimmed.includes("T") ? trimmed.slice(0, 10) : trimmed;
    }
    return null;
  });

/* =========================
 * Shared enums / types
 * ========================= */

// Status enum for animals (frontend + backend)
export const animalStatusEnum = [
  "active",
  "slaughtered",
  "expired",
] as const;

export type AnimalStatus = (typeof animalStatusEnum)[number];

// Polled status enum (replaces boolean)
export const polledStatusEnum = ["polled", "horned", "not tested"] as const;
export type PolledStatus = (typeof polledStatusEnum)[number];

const normalizePolledValue = (
  val: unknown,
): PolledStatus | undefined | "invalid" => {
  if (val === undefined || val === null || val === "") return undefined;

  if (val === true || val === 1) return "polled";
  if (val === false || val === 0) return "not tested";

  if (typeof val === "string") {
    const normalized = val.trim().toLowerCase();
    if (!normalized) return undefined;
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

  return "invalid";
};

// Export herd name enum for use in forms and validation
export const herdNameEnum = mysqlEnum("herd_name", [
  "wet",
  "nurse",
  "finish",
  "main",
  "grafting",
  "yearling",
  "missing",
  "bull",
]);

/* =========================
 * Tables
 * ========================= */

export const animals = mysqlTable("animals", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tagNumber: varchar("tag_number", { length: 255 }).notNull().unique(),
  type: varchar("type", { length: 50 }).notNull(),
  sex: varchar("sex", { length: 20 }).notNull(),
  dateOfBirth: date("date_of_birth"),
  sireId: varchar("sire_id", { length: 36 }),
  damId: varchar("dam_id", { length: 36 }),
  currentFieldId: varchar("current_field_id", { length: 36 }),
  organic: boolean("organic").default(false),
  phenotype: varchar("phenotype", { length: 1000 }),
  polled: mysqlEnum("polled", polledStatusEnum).default("not tested"),
  betacasein: mysqlEnum("betacasein", ["A2/A2", "A1", "Not Tested"]),
  herdName: herdNameEnum,
  status: mysqlEnum("status", animalStatusEnum).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const properties = mysqlTable("properties", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  isLeased: varchar("is_leased", { length: 10 }).notNull(),
  leaseStartDate: date("lease_start_date"),
  leaseEndDate: date("lease_end_date"),
  leaseholder: varchar("leaseholder", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fields = mysqlTable("fields", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  propertyId: varchar("property_id", { length: 36 }).notNull(),
  capacity: int("capacity"),
  acres: int("acres"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const movements = mysqlTable("movements", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  animalId: varchar("animal_id", { length: 36 }).notNull(),
  fromFieldId: varchar("from_field_id", { length: 36 }),
  toFieldId: varchar("to_field_id", { length: 36 }).notNull(),
  movementDate: timestamp("movement_date").notNull(),
  notes: varchar("notes", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vaccinations = mysqlTable("vaccinations", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  animalId: varchar("animal_id", { length: 36 }).notNull(),
  vaccineName: varchar("vaccine_name", { length: 255 }).notNull(),
  administeredDate: date("administered_date").notNull(),
  administeredBy: varchar("administered_by", { length: 255 }),
  nextDueDate: date("next_due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const events = mysqlTable("events", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  animalId: varchar("animal_id", { length: 36 }).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  eventDate: date("event_date").notNull(),
  description: varchar("description", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const breedingMethodEnum = mysqlEnum("method", [
  "observed_live_cover",
  "extended_exposure",
  "ai",
]);

export const breedingRecords = mysqlTable("breeding_records", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  animalId: varchar("animal_id", { length: 36 }).notNull(),
  method: breedingMethodEnum.notNull(),
  breedingDate: date("breeding_date"),
  exposureStartDate: date("exposure_start_date"),
  exposureEndDate: date("exposure_end_date"),
  sireId: varchar("sire_id", { length: 36 }),
  notes: varchar("notes", { length: 2000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const calvingRecords = mysqlTable("calving_records", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  damId: varchar("dam_id", { length: 36 }).notNull(),
  calvingDate: date("calving_date").notNull(),
  calfId: varchar("calf_id", { length: 36 }),
  calfTagNumber: varchar("calf_tag_number", { length: 255 }),
  calfSex: varchar("calf_sex", { length: 20 }),
  notes: varchar("notes", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const slaughterRecords = mysqlTable("slaughter_records", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  animalId: varchar("animal_id", { length: 36 }).notNull(),
  slaughterDate: date("slaughter_date").notNull(),
  ageMonths: int("age_months"),
  liveWeight: decimal("live_weight", { precision: 10, scale: 2 }),
  hangingWeight: decimal("hanging_weight", { precision: 10, scale: 2 }),
  processor: varchar("processor", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notes = mysqlTable("notes", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  animalId: varchar("animal_id", { length: 36 }).notNull(),
  note: varchar("note", { length: 2000 }).notNull(),
  noteDate: date("note_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Session table for express-mysql-session
export const sessions = mysqlTable(
  "sessions",
  {
    sessionId: varchar("session_id", { length: 128 }).primaryKey(),
    expires: int("expires").notNull(),
    data: varchar("data", { length: 5000 }),
  },
  (table) => [index("IDX_session_expire").on(table.expires)],
);

// Users table for authentication
export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  isAdmin: varchar("is_admin", { length: 10 }).notNull().default("no"),
  passwordResetToken: varchar("password_reset_token", { length: 255 }),
  passwordResetExpires: timestamp("password_reset_expires"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* =========================
 * Insert Schemas (Zod)
 * ========================= */

export const insertAnimalSchema = createInsertSchema(animals, {
  // DATE column -> normalized YYYY-MM-DD string
  dateOfBirth: dateOnlyOptional,
  polled: z
    .any()
    .optional()
    .transform((val, ctx) => {
      const normalized = normalizePolledValue(val);
      if (normalized === "invalid") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid polled value. Use polled, horned, or not tested.",
          path: ["polled"],
        });
        return undefined;
      }
      return normalized;
    }),
}).omit({
  id: true,
  createdAt: true,
});

export const insertPropertySchema = createInsertSchema(properties, {
  leaseStartDate: dateOnlyOptional,
  leaseEndDate: dateOnlyOptional,
}).omit({
  id: true,
  createdAt: true,
});

export const insertFieldSchema = createInsertSchema(fields, {
  // Coerce string from input into number
  capacity: z.coerce.number().int().optional().nullable(),
  acres: z.coerce.number().int().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertMovementSchema = createInsertSchema(movements)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    // movementDate is a TIMESTAMP; we keep it as Date so Drizzle can handle it
    movementDate: z
      .union([z.date(), z.string()])
      .transform((val) =>
        typeof val === "string" ? new Date(val) : (val as Date),
      ),
  });

export const insertVaccinationSchema = createInsertSchema(vaccinations, {
  administeredDate: dateOnlyRequired,
  nextDueDate: dateOnlyOptional,
}).omit({
  id: true,
  createdAt: true,
});

export const insertEventSchema = createInsertSchema(events, {
  eventDate: dateOnlyRequired,
}).omit({
  id: true,
  createdAt: true,
});

export const insertCalvingRecordSchema = createInsertSchema(calvingRecords, {
  calvingDate: dateOnlyRequired,
}).omit({
  id: true,
  createdAt: true,
});

export const insertSlaughterRecordSchema = createInsertSchema(slaughterRecords, {
  slaughterDate: dateOnlyRequired, // DATE column, normalized
  ageMonths: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional(), // backend can compute if omitted
}).omit({
  id: true,
  createdAt: true,
});

export const insertNoteSchema = createInsertSchema(notes, {
  noteDate: dateOnlyRequired,
}).omit({
  id: true,
  createdAt: true,
});

export const insertBreedingRecordSchema = createInsertSchema(breedingRecords, {
  breedingDate: dateOnlyOptional,
  exposureStartDate: dateOnlyOptional,
  exposureEndDate: dateOnlyOptional,
}).omit({
  id: true,
  createdAt: true,
}).superRefine((data, ctx) => {
  if (data.method === "extended_exposure") {
    if (!data.exposureStartDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Start date required", path: ["exposureStartDate"] });
    }
    if (!data.exposureEndDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date required", path: ["exposureEndDate"] });
    }
  } else {
    if (!data.breedingDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Breeding date required", path: ["breedingDate"] });
    }
  }
});

/* =========================
 * CSV Import Schemas
 * ========================= */

export const csvAnimalSchema = z.object({
  tagNumber: z.string().min(1),
  type: z.enum(["dairy", "beef"]).or(z.literal("")),
  sex: z
    .enum(["cow", "steer", "stag", "bull", "freemartin"])
    .or(z.enum(["male", "female"])) // legacy values
    .or(z.literal("")),
  dateOfBirth: z.string().optional(),
  sireId: z.string().optional(),
  damId: z.string().optional(),
  currentFieldId: z.string().optional(),
  organic: z
    .string()
    .optional()
    .transform((val) => val?.toLowerCase() === "true"),
  phenotype: z.string().optional(),
  polled: z
    .any()
    .optional()
    .transform((val) => {
      const normalized = normalizePolledValue(val);
      if (normalized === "invalid") {
        throw new Error("Invalid polled value. Use polled, horned, or not tested.");
      }
      return normalized;
    }),
  betacasein: z.enum(["A2/A2", "A1", "Not Tested"]).optional(),
  herdName: z
    .enum([
      "wet",
      "nurse",
      "finish",
      "main",
      "grafting",
      "yearling",
      "missing",
      "bull",
    ])
    .optional(),
  // Allow setting status from CSV, but optional
  status: z.enum(animalStatusEnum).optional(),
});

export const csvPropertySchema = z.object({
  name: z.string().min(1),
  isLeased: z.enum(["yes", "no"]),
  leaseStartDate: z.string().optional(),
  leaseEndDate: z.string().optional(),
  leaseholder: z.string().optional(),
});

export const csvFieldSchema = z.object({
  name: z.string().min(1),
  propertyId: z.string().min(1),
  capacity: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : undefined)),
});

export const csvVaccinationSchema = z.object({
  animalId: z.string().min(1),
  vaccineName: z.string().min(1),
  administeredDate: z.string().min(1),
  administeredBy: z.string().optional(),
  nextDueDate: z.string().optional(),
});

export const csvEventSchema = z.object({
  animalId: z.string().min(1),
  eventType: z.string().min(1),
  eventDate: z.string().min(1),
  description: z.string().optional(),
});

export const csvCalvingRecordSchema = z.object({
  damId: z.string().min(1),
  calvingDate: z.string().min(1),
  calfId: z.string().optional(),
  calfTagNumber: z.string().optional(),
  calfSex: z.enum(["male", "female"]).optional(),
  notes: z.string().optional(),
});

export const csvSlaughterRecordSchema = z.object({
  animalId: z.string().min(1),
  slaughterDate: z.string().min(1),
  ageMonths: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : undefined)),
  liveWeight: z.string().optional(),
  hangingWeight: z.string().optional(),
  processor: z.string().optional(),
});

/* =========================
 * Auth Schemas
 * ========================= */

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6),
});

/* =========================
 * Type exports
 * ========================= */

export type Animal = typeof animals.$inferSelect;
export type InsertAnimal = z.infer<typeof insertAnimalSchema>;

export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;

export type Field = typeof fields.$inferSelect;
export type InsertField = z.infer<typeof insertFieldSchema>;

export type InsertMovement = z.infer<typeof insertMovementSchema>;
export type Movement = typeof movements.$inferSelect;

export type InsertVaccination = z.infer<typeof insertVaccinationSchema>;
export type Vaccination = typeof vaccinations.$inferSelect;

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

export type InsertCalvingRecord = z.infer<typeof insertCalvingRecordSchema>;
export type CalvingRecord = typeof calvingRecords.$inferSelect;

export type InsertSlaughterRecord = z.infer<typeof insertSlaughterRecordSchema>;
export type SlaughterRecord = typeof slaughterRecords.$inferSelect;

export type User = typeof users.$inferSelect;

// Import result type
export type ImportResult = {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  errors: string[];
};
