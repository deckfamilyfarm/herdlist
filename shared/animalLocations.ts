import { z } from "zod";

export const locationDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((day) => {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
}, "Choose a valid location date");

export const locationChangeSchema = z.object({
  date: locationDateSchema,
  expectedFieldId: z.string().min(1).max(36).nullable(),
}).strict();
export type LocationChange = z.infer<typeof locationChangeSchema>;
export function locationToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
