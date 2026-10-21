import test from "node:test";
import assert from "node:assert/strict";
import { findAnimalIssues } from "../shared/animalIssues.ts";

test("Animal Issues prioritizes missing DOB and asks for ownership history after DOB is recorded", () => {
  const source = {
    animals: [
      { id: "a", tagNumber: "10", type: "dairy", status: "active", dateOfBirth: "2020-01-01", currentFieldId: "pasture", ownerId: "creamy" },
      { id: "b", tagNumber: "11", type: "beef", status: "active", dateOfBirth: null, currentFieldId: null, ownerId: "creamy" },
      { id: "c", tagNumber: "12", type: "beef", status: "sold", dateOfBirth: null, currentFieldId: null, ownerId: null },
      { id: "d", tagNumber: "AI-13", type: " AI ", status: "active", dateOfBirth: null, currentFieldId: null, ownerId: null },
    ],
    fields: [{ id: "pasture", name: "Pasture" }, { id: "barn", name: "Dairy Barn" }],
    owners: [{ id: "creamy", name: "Creamy Cow, LLC" }],
    ownership: [{ animalId: "a", ownerId: "creamy", effectiveDate: "2020-01-01" }],
    movements: [
      { id: "old", animalId: "a", toFieldId: "pasture", movementDate: "2026-09-01T00:00:00Z", createdAt: "2026-09-01T12:00:00Z" },
      { id: "new", animalId: "a", toFieldId: "barn", movementDate: "2026-10-01T00:00:00Z", createdAt: "2026-10-01T12:00:00Z" },
    ],
  };
  const issues = findAnimalIssues(source, "2026-10-21");
  assert.deepEqual(issues.map(({ tagNumber, code }) => [tagNumber, code]), [
    ["10", "currentLocationMismatch"], ["11", "missingBirthDate"], ["11", "unknownLocation"],
  ]);
  assert.match(issues[0].detail, /Dairy Barn on 2026-10-01/);
  assert.equal(findAnimalIssues(source, "2026-09-15").some((issue) => issue.animalId === "a"), false);
  assert.equal(issues.some((issue) => issue.animalId === "d"), false);
  source.animals[1].dateOfBirth = "2020-02-01";
  const afterBirthDate = findAnimalIssues(source, "2026-10-21");
  assert.equal(afterBirthDate.some((issue) => issue.animalId === "b" && issue.code === "missingBirthDate"), false);
  assert.match(afterBirthDate.find((issue) => issue.animalId === "b" && issue.code === "missingOwnershipHistory").detail,
    /Record this owner with an effective date/);
  source.ownership.push({ animalId: "b", ownerId: "creamy", effectiveDate: "2020-02-01" });
  assert.equal(findAnimalIssues(source, "2026-10-21").some((issue) => issue.animalId === "b" && issue.code === "missingOwnershipHistory"), false);
});
