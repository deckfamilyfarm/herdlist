import test from "node:test";
import assert from "node:assert/strict";
import { buildAnimalHistory } from "../client/src/lib/animalHistory.ts";

test("Event History includes existing movements and notes when no manual events exist", () => {
  const source = {
    animalId: "cow", animal: { id: "cow", dateOfBirth: "2024-06-19", createdAt: "2025-12-14T07:05:58.000Z" },
    events: [], breeding: [], vaccinations: [], calvingRecords: [],
    slaughterRecords: [], ownershipHistory: [], allAnimals: [],
    fields: [{ id: "pasture", name: "Pasture" }, { id: "barn", name: "Dairy Barn" }],
    movements: [{ id: "move", animalId: "cow", fromFieldId: "barn", toFieldId: "pasture",
      movementDate: "2026-10-20T12:00:00.000Z", notes: "Moved to graze" }],
    notes: [{ id: "note", animalId: "cow", noteDate: "2026-10-21", note: "Looks healthy" }],
  };
  assert.deepEqual(buildAnimalHistory(source).map(({ date, type, description }) =>
    [date, type, description]), [
    ["2026-10-21", "Note", "Looks healthy"],
    ["2026-10-20", "Movement", "Dairy Barn → Pasture · Moved to graze"],
    ["2025-12-14", "Animal added", "Animal record created"],
    ["2024-06-19", "Birth", "Date of birth recorded"],
  ]);
  source.events.push({ id: "event", animalId: "cow", eventDate: "2026-10-22",
    eventType: "Health check", description: "Normal" });
  assert.equal(buildAnimalHistory(source)[0].type, "Health check");
});

test("Event History has an animal-added milestone even without other records or a birth date", () => {
  const items = buildAnimalHistory({
    animalId: "cow", animal: { id: "cow", dateOfBirth: null, createdAt: "2025-12-14T07:05:58.000Z" },
    events: [], movements: [], notes: [], breeding: [], vaccinations: [],
    calvingRecords: [], slaughterRecords: [], ownershipHistory: [], fields: [], allAnimals: [],
  });
  assert.deepEqual(items.map(({ date, type }) => [date, type]), [["2025-12-14", "Animal added"]]);
});

test("Event History shows when an animal became inactive without assigning a cause", () => {
  const items = buildAnimalHistory({
    animalId: "cow", animal: { id: "cow", dateOfBirth: null, inactiveSince: "2026-01-01", createdAt: "2025-12-14T07:05:58.000Z" },
    events: [], movements: [], notes: [], breeding: [], vaccinations: [],
    calvingRecords: [], slaughterRecords: [], ownershipHistory: [], fields: [], allAnimals: [],
  });
  assert.deepEqual(items.map(({ date, type }) => [date, type]),
    [["2026-01-01", "Inactive"], ["2025-12-14", "Animal added"]]);
});
