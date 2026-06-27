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

const MIN_ANIMAL_DOB_YEAR = 2000;

const validateAnimalDateOfBirth = (
  value: string | null,
  ctx: z.RefinementCtx,
) => {
  if (!value) return;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Date of birth must be a valid date.",
    });
    return;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isValidDate =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  if (!isValidDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Date of birth must be a valid date.",
    });
    return;
  }

  const currentYear = new Date().getFullYear();
  if (year < MIN_ANIMAL_DOB_YEAR || year > currentYear) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Date of birth must be between ${MIN_ANIMAL_DOB_YEAR} and ${currentYear}.`,
    });
  }
};

const animalDateOfBirth = dateOnlyOptional.superRefine(
  validateAnimalDateOfBirth,
);

/* =========================
 * Shared enums / types
 * ========================= */

// Status enum for animals (frontend + backend)
export const animalStatusEnum = [
  "active",
  "slaughtered",
  "sold",
  "expired",
] as const;

export type AnimalStatus = (typeof animalStatusEnum)[number];
export const slaughterRecordTypeEnum = ["slaughtered", "sold"] as const;
export type SlaughterRecordType = (typeof slaughterRecordTypeEnum)[number];
export const hayTypeEnum = ["balage", "dry_hay"] as const;
export type HayType = (typeof hayTypeEnum)[number];
export const amendmentTypeEnum = ["reseeding", "manure", "lime"] as const;
export type AmendmentType = (typeof amendmentTypeEnum)[number];
export const manureSpreaderTypeEnum = ["vertical_beater", "horizontal_beater"] as const;
export type ManureSpreaderType = (typeof manureSpreaderTypeEnum)[number];

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
  tags: json("tags").$type<string[] | null>().default(sql`JSON_ARRAY()`),
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
  leaseRatePerAcre: decimal("lease_rate_per_acre", { precision: 10, scale: 2 }),
  boundaryGeoJson: json("boundary_geojson").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fields = mysqlTable("fields", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  propertyId: varchar("property_id", { length: 36 }).notNull(),
  capacity: int("capacity"),
  acres: decimal("acres", { precision: 10, scale: 2 }),
  certifiedOrganic: boolean("certified_organic").default(false),
  boundaryGeoJson: json("boundary_geojson").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const hayRecords = mysqlTable("hay_records", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  fieldId: varchar("field_id", { length: 36 }).notNull(),
  hayType: mysqlEnum("hay_type", hayTypeEnum).notNull(),
  balingDate: date("baling_date").notNull(),
  baleCount: int("bale_count").notNull(),
  baleWeightLbs: decimal("bale_weight_lbs", { precision: 10, scale: 2 }).notNull(),
  dryMatterPercent: decimal("dry_matter_percent", { precision: 5, scale: 2 }).notNull(),
  acresCut: decimal("acres_cut", { precision: 10, scale: 2 }).notNull(),
  storageLocation: varchar("storage_location", { length: 255 }),
  notes: varchar("notes", { length: 2000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fieldAmendmentRecords = mysqlTable("field_amendment_records", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  fieldId: varchar("field_id", { length: 36 }).notNull(),
  amendmentType: mysqlEnum("amendment_type", amendmentTypeEnum).notNull(),
  applicationDate: date("application_date").notNull(),
  acresTreated: decimal("acres_treated", { precision: 10, scale: 2 }).notNull(),
  notes: varchar("notes", { length: 2000 }),
  seedNotes: varchar("seed_notes", { length: 2000 }),
  manureRateYardsPerAcre: decimal("manure_rate_yards_per_acre", { precision: 10, scale: 2 }),
  manureSource: varchar("manure_source", { length: 255 }),
  spreaderType: mysqlEnum("spreader_type", manureSpreaderTypeEnum),
  limeType: varchar("lime_type", { length: 255 }),
  limeTonsPerAcre: decimal("lime_tons_per_acre", { precision: 10, scale: 2 }),
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
  recordType: mysqlEnum("record_type", slaughterRecordTypeEnum)
    .notNull()
    .default("slaughtered"),
  slaughterDate: date("slaughter_date").notNull(),
  ageMonths: int("age_months"),
  liveWeight: decimal("live_weight", { precision: 10, scale: 2 }),
  hangingWeight: decimal("hanging_weight", { precision: 10, scale: 2 }),
  processor: varchar("processor", { length: 255 }),
  buyer: varchar("buyer", { length: 255 }),
  pricePerLb: decimal("price_per_lb", { precision: 10, scale: 2 }),
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
  dateOfBirth: animalDateOfBirth,
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
  tags: z
    .array(z.string())
    .optional()
    .transform((val) => (val && Array.isArray(val) ? val : [])),
}).omit({
  id: true,
  createdAt: true,
});

export const insertPropertySchema = createInsertSchema(properties, {
  leaseStartDate: dateOnlyOptional,
  leaseEndDate: dateOnlyOptional,
  leaseRatePerAcre: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((value, ctx) => {
      if (value === undefined || value === null || value === "") return null;

      const rawValue = typeof value === "number" ? value.toString() : value.trim();
      if (!rawValue) return null;

      if (!/^\d+(\.\d{1,2})?$/.test(rawValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Lease rate must be a non-negative number with up to two decimal places.",
        });
        return z.NEVER;
      }

      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue) || numericValue > 99999999.99) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Lease rate must be less than 100,000,000.",
        });
        return z.NEVER;
      }

      return numericValue.toFixed(2);
    }),
  boundaryGeoJson: z.record(z.any()).optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
});

const optionalAcresSchema = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((value, ctx) => {
    if (value === undefined || value === null || value === "") return null;

    const rawValue = typeof value === "number" ? value.toString() : value.trim();
    if (rawValue === "") return null;

    if (!/^\d+(\.\d{1,2})?$/.test(rawValue)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Acres must be a non-negative number with up to two decimal places.",
      });
      return z.NEVER;
    }

    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue) || numericValue > 99999999.99) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Acres must be less than 100,000,000.",
      });
      return z.NEVER;
    }

    return numericValue.toFixed(2);
  });

const optionalTextSchema = z
  .string()
  .optional()
  .nullable()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed || null;
  });

const decimalStringSchema = (
  label: string,
  options: {
    precision?: number;
    scale?: number;
    min?: number;
    minExclusive?: boolean;
    max?: number;
  } = {},
) => {
  const { precision = 10, scale = 2, min, minExclusive = false, max } = options;
  const decimalPattern = new RegExp(`^\\d+(\\.\\d{1,${scale}})?$`);

  return z.union([z.string(), z.number()]).transform((value, ctx) => {
    const rawValue = typeof value === "number" ? value.toString() : value.trim();
    if (!rawValue || !decimalPattern.test(rawValue)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} must be a number with up to ${scale} decimal places.`,
      });
      return z.NEVER;
    }

    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} must be a valid number.`,
      });
      return z.NEVER;
    }

    if (
      min !== undefined &&
      (minExclusive ? numericValue <= min : numericValue < min)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: minExclusive ? `${label} must be greater than ${min}.` : `${label} must be at least ${min}.`,
      });
      return z.NEVER;
    }

    if (max !== undefined && numericValue > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} must be no more than ${max}.`,
      });
      return z.NEVER;
    }

    const digitsOnly = rawValue.replace(".", "");
    if (digitsOnly.length > precision) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} is too large.`,
      });
      return z.NEVER;
    }

    return numericValue.toFixed(scale);
  });
};

const optionalDecimalStringSchema = (
  label: string,
  options: Parameters<typeof decimalStringSchema>[1] = {},
) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((value, ctx) => {
      if (value === undefined || value === null) return null;
      if (typeof value === "string" && !value.trim()) return null;

      const parsed = decimalStringSchema(label, options).safeParse(value);
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => ctx.addIssue(issue));
        return z.NEVER;
      }

      return parsed.data;
    });

export const insertFieldSchema = createInsertSchema(fields, {
  // Coerce string from input into number
  capacity: z.coerce.number().int().optional().nullable(),
  acres: optionalAcresSchema,
  certifiedOrganic: z.coerce.boolean().optional(),
  boundaryGeoJson: z.record(z.any()).optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertHayRecordSchema = createInsertSchema(hayRecords, {
  balingDate: dateOnlyRequired,
  baleCount: z.coerce.number().int().positive("Bale count must be greater than 0."),
  baleWeightLbs: decimalStringSchema("Bale weight", { min: 0, minExclusive: true }),
  dryMatterPercent: decimalStringSchema("Dry matter percent", { precision: 5, min: 0, max: 100 }),
  acresCut: decimalStringSchema("Acres cut", { min: 0, minExclusive: true }),
  storageLocation: optionalTextSchema,
  notes: optionalTextSchema,
}).omit({
  id: true,
  createdAt: true,
});

export const updateHayRecordSchema = insertHayRecordSchema
  .omit({ fieldId: true })
  .partial();

const baseFieldAmendmentRecordSchema = createInsertSchema(fieldAmendmentRecords, {
  applicationDate: dateOnlyRequired,
  acresTreated: decimalStringSchema("Acres treated", { min: 0, minExclusive: true }),
  notes: optionalTextSchema,
  seedNotes: optionalTextSchema,
  manureRateYardsPerAcre: optionalDecimalStringSchema("Manure rate", { min: 0, minExclusive: true }),
  manureSource: optionalTextSchema,
  limeType: optionalTextSchema,
  limeTonsPerAcre: optionalDecimalStringSchema("Lime tons per acre", { min: 0, minExclusive: true }),
}).omit({
  id: true,
  createdAt: true,
});

const validateFieldAmendmentRecord = (
  data: z.infer<typeof baseFieldAmendmentRecordSchema>,
  ctx: z.RefinementCtx,
) => {
  if (data.amendmentType === "reseeding" && !data.seedNotes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Seed notes are required for reseeding records.",
      path: ["seedNotes"],
    });
  }

  if (data.amendmentType === "manure") {
    if (!data.manureRateYardsPerAcre) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Manure rate is required for manure records.",
        path: ["manureRateYardsPerAcre"],
      });
    }
    if (!data.manureSource) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Manure source is required for manure records.",
        path: ["manureSource"],
      });
    }
    if (!data.spreaderType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Spreader type is required for manure records.",
        path: ["spreaderType"],
      });
    }
  }

  if (data.amendmentType === "lime") {
    if (!data.limeType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Lime type is required for lime records.",
        path: ["limeType"],
      });
    }
    if (!data.limeTonsPerAcre) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Lime tons per acre is required for lime records.",
        path: ["limeTonsPerAcre"],
      });
    }
  }
};

export const insertFieldAmendmentRecordSchema = baseFieldAmendmentRecordSchema.superRefine(
  validateFieldAmendmentRecord,
);

export const updateFieldAmendmentRecordSchema = baseFieldAmendmentRecordSchema
  .omit({ fieldId: true })
  .partial();

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
})
  .omit({
    id: true,
    createdAt: true,
  })
  .superRefine((data, ctx) => {
    const recordType = data.recordType ?? "slaughtered";
    if (recordType === "sold") {
      if (!data.liveWeight) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Live weight is required for sold records.",
          path: ["liveWeight"],
        });
      }
      if (!data.buyer || !data.buyer.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Buyer is required for sold records.",
          path: ["buyer"],
        });
      }
    }
  });

export const insertNoteSchema = createInsertSchema(notes, {
  noteDate: dateOnlyRequired,
}).omit({
  id: true,
  createdAt: true,
});

export const csvNoteSchema = z
  .object({
    tagNumber: z.string().min(1).optional(),
    tag_number: z.string().min(1).optional(),
    note: z.string().min(1),
    noteDate: z.string().min(1).optional(),
    note_date: z.string().min(1).optional(),
  })
  .transform((val) => {
    return {
      tagNumber: (val.tagNumber || val.tag_number || "").toString(),
      note: val.note,
      noteDate: (val.noteDate || val.note_date || "").toString(),
    };
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
  dateOfBirth: animalDateOfBirth.optional(),
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
  leaseRatePerAcre: optionalDecimalStringSchema("Lease rate", { min: 0 }).optional(),
});

export const csvFieldSchema = z.object({
  name: z.string().min(1),
  propertyName: z.string().min(1),
  capacity: z
    .string()
    .optional()
    .transform((val, ctx) => {
      if (!val?.trim()) return null;

      const capacity = Number(val);
      if (!Number.isInteger(capacity)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Capacity must be a whole number.",
        });
        return z.NEVER;
      }

      return capacity;
    }),
  acres: optionalAcresSchema,
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
  animalTag: z.string().min(1),
  recordType: z
    .string()
    .optional()
    .transform((val): SlaughterRecordType => {
      const normalized = (val || "").trim().toLowerCase();
      if (!normalized || normalized === "slaughtered" || normalized === "slaughter") {
        return "slaughtered";
      }
      if (normalized === "sold" || normalized === "sale") {
        return "sold";
      }
      throw new Error("recordType must be slaughtered or sold");
    }),
  slaughterDate: z.string().min(1),
  ageMonths: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || !val.trim()) return undefined;
      const parsed = parseInt(val, 10);
      if (Number.isNaN(parsed)) throw new Error("ageMonths must be an integer");
      return parsed;
    }),
  liveWeight: z.string().optional(),
  hangingWeight: z.string().optional(),
  processor: z.string().optional(),
  buyer: z.string().optional(),
  pricePerLb: z.string().optional(),
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
  username: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  password: z.string(),
}).refine((value) => value.username || value.email, {
  message: "Username is required",
  path: ["username"],
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
export type AnimalDueDateStatus = "normal" | "overdue-struck";
export type AnimalListItem = Animal & {
  currentFieldName?: string | null;
  currentLocation?: string;
  sireTagNumber?: string | null;
  damTagNumber?: string | null;
  dueDate: string | null;
  dueDateStatus: AnimalDueDateStatus | null;
  dueDateBreedingRecordId: string | null;
};
export type InsertAnimal = z.infer<typeof insertAnimalSchema>;

export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;

export type Field = typeof fields.$inferSelect;
export type InsertField = z.infer<typeof insertFieldSchema>;

export type HayRecord = typeof hayRecords.$inferSelect;
export type InsertHayRecord = z.infer<typeof insertHayRecordSchema>;
export type HayRecordWithMetrics = HayRecord & {
  totalDmTons: number;
  tonDmPerAcre: number | null;
};
export type FieldHaySummary = {
  fieldId: string;
  year: number;
  cutCount: number;
  dryHayBales: number;
  balageBales: number;
  totalDmTons: number;
  tonDmPerAcre: number | null;
};

export type FieldAmendmentRecord = typeof fieldAmendmentRecords.$inferSelect;
export type InsertFieldAmendmentRecord = z.infer<typeof insertFieldAmendmentRecordSchema>;

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

export type CsvNoteRow = z.infer<typeof csvNoteSchema>;

export const animalTagOptions = ["open", "wet", "bred", "grafting", "missing", "cull"] as const;
