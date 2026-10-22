export type AnimalIssueCode = "missingBirthDate" | "unknownLocation" | "currentLocationMismatch" |
  "unknownOwner" | "missingOwnershipHistory";

export type AnimalIssue = {
  animalId: string;
  tagNumber: string;
  type: string;
  code: AnimalIssueCode;
  detail: string;
  currentFieldName: string | null;
  ownerName: string | null;
};

export type AnimalIssueSource = {
  animals: Array<{
    id: string; tagNumber: string; type: string; status: string;
    currentFieldId: string | null; ownerId: string | null; dateOfBirth: string | null;
  }>;
  fields: Array<{ id: string; name: string }>;
  owners: Array<{ id: string; name: string }>;
  ownership: Array<{ animalId: string; ownerId: string; effectiveDate: string }>;
  movements: Array<{
    id: string; animalId: string; toFieldId: string | null;
    movementDate: string; createdAt: string;
  }>;
};

export function findAnimalIssues(source: AnimalIssueSource, today: string): AnimalIssue[] {
  const fields = new Map(source.fields.map((field) => [field.id, field.name]));
  const owners = new Map(source.owners.map((owner) => [owner.id, owner.name]));
  const latestMove = new Map<string, AnimalIssueSource["movements"][number]>();
  for (const move of source.movements) {
    if (move.movementDate.slice(0, 10) > today) continue;
    const prior = latestMove.get(move.animalId);
    if (!prior || move.movementDate > prior.movementDate ||
      (move.movementDate === prior.movementDate && move.createdAt > prior.createdAt) ||
      (move.movementDate === prior.movementDate && move.createdAt === prior.createdAt && move.id > prior.id))
      latestMove.set(move.animalId, move);
  }
  const latestOwner = new Map<string, AnimalIssueSource["ownership"][number]>();
  for (const entry of source.ownership) {
    if (entry.effectiveDate > today) continue;
    const prior = latestOwner.get(entry.animalId);
    if (!prior || entry.effectiveDate > prior.effectiveDate) latestOwner.set(entry.animalId, entry);
  }
  const issues: AnimalIssue[] = [];
  for (const animal of source.animals) {
    if (animal.status !== "active" && animal.status !== "inactive") continue;
    const currentFieldName = animal.currentFieldId ? fields.get(animal.currentFieldId) || null : null;
    const ownerName = animal.ownerId ? owners.get(animal.ownerId) || null : null;
    const add = (code: AnimalIssueCode, detail: string) => issues.push({
      animalId: animal.id, tagNumber: animal.tagNumber, type: animal.type,
      code, detail, currentFieldName, ownerName,
    });
    if (animal.status === "active" && animal.type.trim().toLowerCase() !== "ai" && !animal.dateOfBirth)
      add("missingBirthDate", "No date of birth is recorded. Add one before reviewing dated ownership.");
    if (!currentFieldName || currentFieldName.trim().toLowerCase() === "missing")
      add("unknownLocation", "No usable current field is assigned.");
    if (animal.status !== "active" || animal.type.trim().toLowerCase() === "ai") continue;
    const movement = latestMove.get(animal.id);
    if (currentFieldName && movement && movement.toFieldId !== animal.currentFieldId) {
      const movedTo = movement.toFieldId ? fields.get(movement.toFieldId) : null;
      add("currentLocationMismatch", `Current field is ${currentFieldName}; latest movement went to ${movedTo || "an unknown field"} on ${movement.movementDate.slice(0, 10)}.`);
    }
    if (animal.dateOfBirth) {
      const datedOwner = latestOwner.get(animal.id);
      if (!ownerName) add("unknownOwner", "No valid current owner is assigned.");
      else if (!datedOwner || !owners.has(datedOwner.ownerId))
        add("missingOwnershipHistory", `Current owner is ${ownerName}. Record this owner with an effective date in the animal editor.`);
    }
  }
  const order: Record<AnimalIssueCode, number> = {
    missingBirthDate: 0, unknownLocation: 1, currentLocationMismatch: 2,
    unknownOwner: 3, missingOwnershipHistory: 4,
  };
  return issues.sort((a, b) => a.tagNumber.localeCompare(b.tagNumber, undefined, { numeric: true }) ||
    order[a.code] - order[b.code]);
}
