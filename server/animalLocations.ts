import crypto from "node:crypto";
import { eq, desc } from "drizzle-orm";
import { fields, movements } from "@shared/schema";
import type { db } from "./db";
import { locationDateSchema, locationToday } from "../shared/animalLocations";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const locationProblem = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });

export async function requireAnimalLocation(tx: Transaction, status: string | undefined, fieldId: string | null | undefined) {
  if (["active", "inactive"].includes((status || "active").trim().toLowerCase()) && !fieldId)
    throw locationProblem(400, "Animals require a location. Choose a field before saving.");
  if (fieldId) {
    const [field] = await tx.select({ id: fields.id, name: fields.name }).from(fields).where(eq(fields.id, fieldId)).for("update");
    if (!field) throw locationProblem(400, "Choose an existing current location.");
    if (["active", "inactive"].includes((status || "active").trim().toLowerCase()) && field.name.trim().toLowerCase() === "missing")
      throw locationProblem(400, "Choose a location other than Missing.");
  }
}

export function requireInitialLocationDate(value: string | undefined, birthDate?: string | Date | null,
  inactiveSince?: string | Date | null): Date {
  const parsed = locationDateSchema.safeParse(value);
  if (!parsed.success) throw locationProblem(400, "Choose a valid initial location date.");
  const day = parsed.data;
  const birthDay = birthDate instanceof Date ? birthDate.toISOString().slice(0, 10) : birthDate;
  const inactiveDay = inactiveSince instanceof Date ? inactiveSince.toISOString().slice(0, 10) : inactiveSince;
  if (day > locationToday()) throw locationProblem(400, "Initial location date cannot be in the future.");
  if (birthDay && day < birthDay) throw locationProblem(400, "Initial location date cannot precede birth.");
  if (inactiveDay && day > inactiveDay) throw locationProblem(400, "Initial location date cannot follow the inactive date.");
  return new Date(`${day}T00:00:00Z`);
}

export async function recordLocationChange(tx: Transaction, animalId: string, fromFieldId: string | null, toFieldId: string, dateInput: Date, notes: string | null) {
  let movementDate = new Date(dateInput);
  if (!Number.isFinite(movementDate.getTime())) throw locationProblem(400, "Choose a valid movement date.");
  const today = locationToday();
  if (movementDate.toISOString().slice(0, 10) > today) throw locationProblem(400, "A current location change cannot have a future date.");
  await requireAnimalLocation(tx, "active", toFieldId);
  const [latest] = await tx.select().from(movements).where(eq(movements.animalId, animalId))
    .orderBy(desc(movements.movementDate), desc(movements.createdAt)).limit(1);
  if (latest && movementDate <= latest.movementDate) {
    if (movementDate.toISOString().slice(0, 10) !== latest.movementDate.toISOString().slice(0, 10))
      throw locationProblem(409, "This date precedes the latest movement. Add or correct historical movements on the animal's movement-history screen.");
    // Preserve known save order within a date even with second-precision columns.
    movementDate = new Date(latest.movementDate.getTime() + 1000);
    if (movementDate.toISOString().slice(0, 10) !== latest.movementDate.toISOString().slice(0, 10))
      throw locationProblem(409, "This date has no room after the latest timed movement. Review its history before saving.");
  }
  const id = crypto.randomUUID();
  await tx.insert(movements).values({ id, animalId, fromFieldId, toFieldId, movementDate, notes });
  return id;
}
