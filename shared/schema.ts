import { sql } from "drizzle-orm";
import { mysqlTable, varchar, timestamp, int, decimal, date, json, index, boolean, mysqlEnum } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export herd name enum for use in forms and validation
export const herdNameEnum = mysqlEnum("herd_name", ["wet", "nurse", "finish", "main", "grafting", "yearlings"]);

export const animals = mysqlTable("animals", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  tagNumber: varchar("tag_number", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  type: varchar("type", { length: 50 }).notNull(),
  sex: varchar("sex", { length: 20 }).notNull(),
  dateOfBirth: date("date_of_birth"),
  breedingMethod: varchar("breeding_method", { length: 100 }),
  sireId: varchar("sire_id", { length: 36 }),
  damId: varchar("dam_id", { length: 36 }),
  currentFieldId: varchar("current_field_id", { length: 36 }),
  organic: boolean("organic").default(false),
  herdName: herdNameEnum,
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const properties = mysqlTable("properties", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  isLeased: varchar("is_leased", { length: 10 }).notNull(),
  leaseStartDate: date("lease_start_date"),
  leaseEndDate: date("lease_end_date"),
  leaseholder: varchar("leaseholder", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fields = mysqlTable("fields", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  propertyId: varchar("property_id", { length: 36 }).notNull(),
  capacity: int("capacity"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const movements = mysqlTable("movements", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  animalId: varchar("animal_id", { length: 36 }).notNull(),
  fromFieldId: varchar("from_field_id", { length: 36 }),
  toFieldId: varchar("to_field_id", { length: 36 }).notNull(),
  movementDate: timestamp("movement_date").notNull(),
  notes: varchar("notes", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vaccinations = mysqlTable("vaccinations", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  animalId: varchar("animal_id", { length: 36 }).notNull(),
  vaccineName: varchar("vaccine_name", { length: 255 }).notNull(),
  administeredDate: date("administered_date").notNull(),
  administeredBy: varchar("administered_by", { length: 255 }),
  nextDueDate: date("next_due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const events = mysqlTable("events", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  animalId: varchar("animal_id", { length: 36 }).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  eventDate: date("event_date").notNull(),
  description: varchar("description", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const calvingRecords = mysqlTable("calving_records", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  damId: varchar("dam_id", { length: 36 }).notNull(),
  calvingDate: date("calving_date").notNull(),
  calfId: varchar("calf_id", { length: 36 }),
  calfTagNumber: varchar("calf_tag_number", { length: 255 }),
  calfSex: varchar("calf_sex", { length: 20 }),
  notes: varchar("notes", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const slaughterRecords = mysqlTable("slaughter_records", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  animalId: varchar("animal_id", { length: 36 }).notNull(),
  slaughterDate: date("slaughter_date").notNull(),
  ageMonths: int("age_months"),
  liveWeight: decimal("live_weight", { precision: 10, scale: 2 }),
  hangingWeight: decimal("hanging_weight", { precision: 10, scale: 2 }),
  processor: varchar("processor", { length: 255 }),
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
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
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

export const insertAnimalSchema = createInsertSchema(animals).omit({
  id: true,
  createdAt: true,
});

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  createdAt: true,
});

export const insertFieldSchema = createInsertSchema(fields).omit({
  id: true,
  createdAt: true,
});

export const insertMovementSchema = createInsertSchema(movements).omit({
  id: true,
  createdAt: true,
}).extend({
  movementDate: z.union([z.date(), z.string()]).transform(val => typeof val === 'string' ? new Date(val) : val),
});

export const insertVaccinationSchema = createInsertSchema(vaccinations).omit({
  id: true,
  createdAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});

export const insertCalvingRecordSchema = createInsertSchema(calvingRecords).omit({
  id: true,
  createdAt: true,
});

export const insertSlaughterRecordSchema = createInsertSchema(slaughterRecords).omit({
  id: true,
  createdAt: true,
});

// CSV Import Schemas
export const csvAnimalSchema = z.object({
  tagNumber: z.string().min(1),
  name: z.string().optional(),
  type: z.enum(['dairy', 'beef']),
  sex: z.enum(['male', 'female']),
  dateOfBirth: z.string().optional(),
  breedingMethod: z.string().optional(),
  sireId: z.string().optional(),
  damId: z.string().optional(),
  currentFieldId: z.string().optional(),
  organic: z.string().optional().transform(val => val?.toLowerCase() === 'true'),
  herdName: z.enum(['wet', 'nurse', 'finish', 'main', 'grafting', 'yearlings']).optional(),
});

export const csvPropertySchema = z.object({
  name: z.string().min(1),
  isLeased: z.enum(['yes', 'no']),
  leaseStartDate: z.string().optional(),
  leaseEndDate: z.string().optional(),
  leaseholder: z.string().optional(),
});

export const csvFieldSchema = z.object({
  name: z.string().min(1),
  propertyId: z.string().min(1),
  capacity: z.string().optional().transform(val => val ? parseInt(val) : undefined),
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
  calfSex: z.enum(['male', 'female']).optional(),
  notes: z.string().optional(),
});

export const csvSlaughterRecordSchema = z.object({
  animalId: z.string().min(1),
  slaughterDate: z.string().min(1),
  ageMonths: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  liveWeight: z.string().optional(),
  hangingWeight: z.string().optional(),
  processor: z.string().optional(),
});

// Authentication schemas
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

// Type exports
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
