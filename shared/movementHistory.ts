import { z } from "zod";

const fieldId = z.string().min(1).max(36);
export const historyEntrySchema = z.object({
  fromFieldId: fieldId.nullable(),
  toFieldId: fieldId,
  movementDate: z.string().datetime({ offset: true }).refine((value) => {
    const day = value.slice(0, 10);
    const parsed = new Date(`${day}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
  }, "Choose a valid movement date"),
  notes: z.string().max(1000).nullable(),
}).strict();
export const historyCorrectionSchema = z.object({
  entry: historyEntrySchema,
  expected: historyEntrySchema,
}).strict();
export type HistoryEntry = z.infer<typeof historyEntrySchema>;
export type HistoryCorrection = z.infer<typeof historyCorrectionSchema>;
