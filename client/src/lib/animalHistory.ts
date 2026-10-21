import type {
  Animal, BreedingRecord, CalvingRecord, Event, Field, Movement,
  Note, SlaughterRecord, Vaccination,
} from "@shared/schema";

export type AnimalHistoryItem = { key: string; date: string; type: string; description: string };
type OwnershipEntry = { id: string; ownerName: string; effectiveDate: string };
type HistorySources = {
  animalId: string;
  animal: Pick<Animal, "id" | "dateOfBirth" | "inactiveSince" | "createdAt">;
  events: Event[];
  movements: Movement[];
  notes: Note[];
  breeding: BreedingRecord[];
  vaccinations: Vaccination[];
  calvingRecords: CalvingRecord[];
  slaughterRecords: SlaughterRecord[];
  ownershipHistory: OwnershipEntry[];
  fields: Field[];
  allAnimals: Array<Pick<Animal, "id" | "tagNumber">>;
};

const dayOf = (value: string | Date | null | undefined) =>
  value ? (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10) : "";

export function buildAnimalHistory(source: HistorySources): AnimalHistoryItem[] {
  const items: AnimalHistoryItem[] = [];
  const add = (key: string, date: string | Date | null | undefined, type: string, description: string) => {
    const day = dayOf(date);
    if (day) items.push({ key, date: day, type, description });
  };
  const fieldNames = new Map(source.fields.map((field) => [field.id, field.name]));
  const animalTags = new Map(source.allAnimals.map((animal) => [animal.id, animal.tagNumber]));
  add(`animal-added-${source.animal.id}`, source.animal.createdAt, "Animal added", "Animal record created");
  if (source.animal.dateOfBirth)
    add(`birth-${source.animal.id}`, source.animal.dateOfBirth, "Birth", "Date of birth recorded");
  if (source.animal.inactiveSince)
    add(`inactive-${source.animal.id}`, source.animal.inactiveSince, "Inactive",
      "First inactive day; disposition unknown");
  for (const event of source.events)
    add(`event-${event.id}`, event.eventDate, event.eventType, event.description || "Recorded event");
  for (const move of source.movements) {
    const from = move.fromFieldId ? fieldNames.get(move.fromFieldId) || "Unknown field" : "Unassigned";
    const to = move.toFieldId ? fieldNames.get(move.toFieldId) || "Unknown field" : "Unassigned";
    add(`movement-${move.id}`, move.movementDate, "Movement",
      [`${from} → ${to}`, move.notes].filter(Boolean).join(" · "));
  }
  for (const note of source.notes) add(`note-${note.id}`, note.noteDate, "Note", note.note);
  for (const record of source.breeding) {
    const sire = record.sireId ? animalTags.get(record.sireId) : null;
    add(`breeding-${record.id}`, record.breedingDate || record.exposureStartDate || record.createdAt,
      "Breeding", [record.method.replace(/_/g, " "), sire && `Sire ${sire}`,
        record.exposureEndDate && `Through ${dayOf(record.exposureEndDate)}`, record.notes]
        .filter(Boolean).join(" · "));
  }
  for (const vaccination of source.vaccinations)
    add(`vaccination-${vaccination.id}`, vaccination.administeredDate, "Vaccination",
      [vaccination.vaccineName, vaccination.administeredBy && `By ${vaccination.administeredBy}`]
        .filter(Boolean).join(" · "));
  for (const record of source.calvingRecords)
    add(`calving-${record.id}`, record.calvingDate, "Calving",
      [record.calfTagNumber && `Calf ${record.calfTagNumber}`, record.notes]
        .filter(Boolean).join(" · ") || "Calving recorded");
  for (const record of source.slaughterRecords.filter((item) => item.animalId === source.animalId))
    add(`exit-${record.id}`, record.slaughterDate,
      record.recordType === "sold" ? "Sold" : "Slaughtered",
      [record.buyer && `Buyer ${record.buyer}`, record.processor && `Processor ${record.processor}`]
        .filter(Boolean).join(" · ") || "Exit recorded");
  for (const owner of source.ownershipHistory)
    add(`owner-${owner.id}`, owner.effectiveDate, "Ownership", `Assigned to ${owner.ownerName}`);
  return items.sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type) || a.key.localeCompare(b.key));
}
