import test from "node:test";
import assert from "node:assert/strict";
import { calculateGrazingServices, serviceRateCentsOnDay } from "../shared/grazingServices.ts";

const dairy = {
  id: "cow", tagNumber: "Cow", phenotype: "Holstein", type: "dairy", sex: "female", status: "active",
  dateOfBirth: "2026-03-15", currentFieldId: "pasture",
};
const dairyContract = {
  id: "dairy", name: "Creamy Cow dairy", ownerId: "creamy", ownerName: "Creamy Cow, LLC",
  kind: "dairy", activeFrom: "2020-01-01", activeTo: null,
  dairyBarnFieldId: "barn",
};
function source() {
  return {
    animals: [{ ...dairy }],
    fields: [{ id: "pasture", name: "Pasture" }, { id: "barn", name: "Dairy Barn" }, { id: "missing", name: "Missing" }],
    movements: [{ id: "first", animalId: "cow", fromFieldId: null, toFieldId: "pasture",
      movementDate: "2026-01-01T00:00:00Z", createdAt: "2026-01-01T12:00:00Z" }],
    ownership: [{ animalId: "cow", ownerId: "creamy", effectiveDate: "2026-03-15" }],
    exits: [], contracts: [{ ...dairyContract }], assignments: [],
    rates: [{ contractId: "dairy", effectiveDate: "2015-01-01", rateCents: 250 }],
  };
}
const report = (input) => calculateGrazingServices(input, "2026-09", "2026-10-19");

test("seasonal age prices use each grazing day, including the exact 12-month anniversary", () => {
  const rate = { contractId: "dairy", effectiveDate: "2026-10-20", rateCents: 100,
    seasonStartMonth: 12, seasonEndMonth: 3, ageThresholdMonths: 12,
    olderRateCents: 325, youngerRateCents: 150, freeUnderMonths: 6 };
  assert.equal(serviceRateCentsOnDay(rate, "2026-11-30", "2025-01-01"), 100);
  assert.equal(serviceRateCentsOnDay(rate, "2026-12-01", "2025-01-01"), 325);
  assert.equal(serviceRateCentsOnDay(rate, "2026-12-01", "2025-12-01"), 150);
  assert.equal(serviceRateCentsOnDay(rate, "2026-12-02", "2025-12-01"), 325);
  assert.equal(serviceRateCentsOnDay(rate, "2027-03-31", "2026-09-01"), 150);
  assert.equal(serviceRateCentsOnDay(rate, "2027-04-01", "2025-01-01"), 100);
  assert.equal(serviceRateCentsOnDay(rate, "2026-12-01", null), 325);
  assert.equal(serviceRateCentsOnDay(rate, "2026-12-31", "2026-07-01"), 0);
  assert.equal(serviceRateCentsOnDay(rate, "2027-01-01", "2026-07-01"), 150);
  assert.equal(serviceRateCentsOnDay(rate, "2026-10-31", "2026-05-01"), 0);
  assert.equal(serviceRateCentsOnDay(rate, "2026-11-01", "2026-05-01"), 100);
});

test("a new seasonal rate leaves prior months unchanged and prices adult and calf rows separately", () => {
  const input = source();
  input.animals[0].dateOfBirth = "2025-01-01";
  input.animals.push({ ...dairy, id: "calf", tagNumber: "Calf", dateOfBirth: "2026-05-01" });
  input.movements.push({ id: "calf-move", animalId: "calf", fromFieldId: null, toFieldId: "pasture",
    movementDate: "2026-05-01T00:00:00Z", createdAt: "2026-05-01T12:00:00Z" });
  input.ownership.push({ animalId: "calf", ownerId: "creamy", effectiveDate: "2026-05-01" });
  input.rates[0].rateCents = 75;
  input.rates.push({ contractId: "dairy", effectiveDate: "2026-10-20", rateCents: 100,
    seasonStartMonth: 12, seasonEndMonth: 3, ageThresholdMonths: 12,
    olderRateCents: 325, youngerRateCents: 150, freeUnderMonths: 6 });
  const september = calculateGrazingServices(input, "2026-09", "2027-04-02");
  assert.equal(september.contracts[0].amountCents, 30 * 75);
  const october = calculateGrazingServices(input, "2026-10", "2027-04-02");
  assert.equal(october.contracts[0].amountCents, 19 * 75 + 12 * 100);
  assert.equal(october.contracts[0].headDays, 31 + 12);
  assert.equal(october.contracts[0].rows.find((row) => row.tagNumber === "Calf")?.amountCents, 0);
  const december = calculateGrazingServices(input, "2026-12", "2027-04-02");
  assert.deepEqual(december.contracts[0].rows.map(({ tagNumber, amountCents }) => [tagNumber, amountCents]),
    [["Calf", 31 * 150], ["Cow", 31 * 325]]);
});

test("dairy charges only days after six months and outside Dairy Barn", () => {
  const input = source();
  input.movements.push({ id: "barn", animalId: "cow", fromFieldId: "pasture", toFieldId: "barn",
    movementDate: "2026-09-20T00:00:00Z", createdAt: "2026-09-20T12:00:00Z" });
  input.animals[0].currentFieldId = "barn";
  const result = report(input);
  assert.equal(result.contracts[0].headDays, 4);
  assert.equal(result.contracts[0].amountCents, 1000);
  assert.deepEqual(result.contracts[0].rows.map(({ tagNumber, phenotype, type, sex, dateOfBirth }) =>
    ({ tagNumber, phenotype, type, sex, dateOfBirth })), [
    { tagNumber: "Cow", phenotype: "Holstein", type: "dairy", sex: "female", dateOfBirth: "2026-03-15" },
  ]);
});

test("general contracts count assigned days including barn days; overlaps charge once", () => {
  const input = source();
  input.contracts.push({ id: "general", name: "Other", ownerId: "creamy", ownerName: "Creamy Cow, LLC",
    kind: "general", activeFrom: "2026-09-01", activeTo: null,
    dairyBarnFieldId: null });
  input.rates.push({ contractId: "general", effectiveDate: "2015-01-01", rateCents: 100 });
  input.assignments.push({ id: "assignment", contractId: "general", animalId: "cow",
    startDate: "2026-09-01", endDate: null });
  const result = report(input);
  assert.equal(result.contracts[0].headDays, 15);
  assert.equal(result.contracts[1].headDays, 15);
  assert.equal(result.contracts[1].amountCents, 1500);
  assert.equal(result.issues.find((issue) => issue.code === "overlap")?.days, 15);
  assert.equal(result.contracts.reduce((sum, contract) => sum + contract.headDays, 0), 30);
});

test("owner mismatches warn but count through a dated exit; missing rates remain visible", () => {
  const input = source();
  input.ownership.push({ animalId: "cow", ownerId: "other", effectiveDate: "2026-09-21" });
  input.exits.push({ animalId: "cow", date: "2026-09-25" });
  input.animals[0].status = "sold";
  input.animals[0].currentFieldId = null;
  input.rates = [];
  const result = report(input);
  assert.equal(result.contracts[0].headDays, 10);
  assert.equal(result.contracts[0].amountCents, 0);
  assert.equal(result.contracts[0].unpricedHeadDays, 10);
  assert.equal(result.hasUnpricedDays, true);
  assert.equal(result.issues.find((issue) => issue.code === "ownerMismatch")?.days, 5);
});

test("missing movement history warns and uses a known current pasture; unknown location stays uncharged", () => {
  const input = source();
  input.movements = [];
  assert.equal(report(input).contracts[0].headDays, 15);
  assert.equal(report(input).issues.find((issue) => issue.code === "unknownLocation")?.days, 15);
  input.animals[0].currentFieldId = null;
  assert.equal(report(input).contracts[0].headDays, 0);
  input.animals[0].currentFieldId = "barn";
  assert.equal(report(input).contracts[0].headDays, 0);
});

test("non-barn warning days still count with missing ownership, barn setup, and conflicting pasture moves", () => {
  const input = source();
  input.animals[0].dateOfBirth = "2020-01-01";
  input.ownership = [];
  input.contracts[0].dairyBarnFieldId = null;
  input.fields.push({ id: "pasture-2", name: "Second Pasture" });
  input.movements.push(
    { id: "tie-a", animalId: "cow", fromFieldId: "pasture", toFieldId: "pasture-2",
      movementDate: "2026-09-20T00:00:00Z", createdAt: "2026-09-20T12:00:00Z" },
    { id: "tie-b", animalId: "cow", fromFieldId: "pasture", toFieldId: "pasture",
      movementDate: "2026-09-20T00:00:00Z", createdAt: "2026-09-20T12:00:00Z" },
  );
  const result = report(input);
  assert.equal(result.contracts[0].headDays, 30);
  assert.equal(result.contracts[0].amountCents, 7500);
  assert.equal(result.issues.find((issue) => issue.code === "unknownOwner")?.days, 30);
  assert.equal(result.issues.find((issue) => issue.code === "missingBarnField")?.days, 30);
  assert.equal(result.issues.find((issue) => issue.code === "historyConflict")?.days, 11);
});

test("a correction to movement history changes the old month without changing its saved rate", () => {
  const input = source();
  const before = report(input);
  assert.equal(before.contracts[0].headDays, 15);
  input.movements.push({ id: "corrected", animalId: "cow", fromFieldId: "pasture", toFieldId: "barn",
    movementDate: "2026-09-25T00:00:00Z", createdAt: "2026-10-19T12:00:00Z" });
  input.animals[0].currentFieldId = "barn";
  const after = report(input);
  assert.equal(after.contracts[0].headDays, 9);
  assert.equal(after.contracts[0].amountCents, 2250);
});

test("a movement origin mismatch does not affect dairy billing or create a review item", () => {
  const input = source();
  const move = { id: "mismatch", animalId: "cow", fromFieldId: "barn", toFieldId: "pasture",
    movementDate: "2026-09-20T00:00:00Z", createdAt: "2026-09-20T12:00:00Z" };
  input.movements.push(move);
  const outsideBarn = report(input);
  assert.equal(outsideBarn.contracts[0].headDays, 15);
  assert.equal(outsideBarn.issues.length, 0);

  move.toFieldId = "barn";
  input.animals[0].currentFieldId = "barn";
  const inBarn = report(input);
  assert.equal(inBarn.contracts[0].headDays, 4);
  assert.equal(inBarn.issues.length, 0);
});

test("missing birth date is assumed older than one year, while undated inactive animals are excluded", () => {
  const input = source();
  input.animals[0].dateOfBirth = null;
  const assumedAdult = report(input);
  assert.equal(assumedAdult.contracts[0].headDays, 30);
  assert.equal(assumedAdult.issues.length, 0);
  input.ownership = [];
  const unknownOwner = report(input);
  assert.equal(unknownOwner.contracts[0].headDays, 30);
  assert.equal(unknownOwner.issues.find((issue) => issue.code === "unknownOwner")?.days, 30);
  input.animals[0].dateOfBirth = "2020-01-01";
  for (const status of ["slaughtered", "expired", "sold"]) {
    input.animals[0].status = status;
    const result = report(input);
    assert.equal(result.contracts[0].headDays, 0);
    assert.equal(result.contracts[0].rows.length, 0);
    assert.equal(result.issues.length, 0);
  }
});

test("a dated slaughter, expiration, or sale counts through its exit day", () => {
  for (const status of ["slaughtered", "expired", "sold"]) {
    const input = source();
    input.animals[0].dateOfBirth = "2020-01-01";
    input.animals[0].status = status;
    input.animals[0].currentFieldId = null;
    input.exits.push({ animalId: "cow", date: "2026-09-16" });
    const result = report(input);
    assert.equal(result.contracts[0].headDays, 16, status);
    assert.equal(result.contracts[0].rows.length, 1, status);
    assert.equal(result.contracts[0].amountCents, 4000, status);
  }
});

test("unknown-disposition inactivity starts on its date and excludes all of 2026 when set to January 1", () => {
  const input = source();
  input.animals[0].dateOfBirth = "2020-01-01";
  input.animals[0].status = "inactive";
  input.animals[0].inactiveSince = "2026-09-16";
  assert.equal(report(input).contracts[0].headDays, 15);
  input.animals[0].inactiveSince = "2026-01-01";
  assert.equal(calculateGrazingServices(input, "2026-01", "2026-10-19").contracts[0].headDays, 0);
  assert.equal(report(input).contracts[0].headDays, 0);
  input.animals[0].inactiveSince = null;
  assert.equal(report(input).contracts[0].headDays, 0, "Undated inactivity remains excluded");
});

test("same-day contradictory movements are not billed; known outside-barn location mismatches are warnings", () => {
  const input = source();
  input.movements.push({ id: "tie", animalId: "cow", fromFieldId: "pasture", toFieldId: "barn",
    movementDate: "2026-09-20T00:00:00Z", createdAt: "2026-09-20T12:00:00Z" },
    { id: "tie-2", animalId: "cow", fromFieldId: "pasture", toFieldId: "pasture",
      movementDate: "2026-09-20T00:00:00Z", createdAt: "2026-09-20T12:00:00Z" });
  const conflicted = report(input);
  assert.equal(conflicted.contracts[0].headDays, 4);
  assert.equal(conflicted.issues.find((issue) => issue.code === "historyConflict")?.days, 11);
  input.movements = input.movements.slice(0, 1);
  input.fields.push({ id: "other-pasture", name: "Other Pasture" });
  input.animals[0].currentFieldId = "other-pasture";
  const outsideMismatch = report(input);
  assert.equal(outsideMismatch.contracts[0].headDays, 15);
  assert.equal(outsideMismatch.issues.find((issue) => issue.code === "currentLocationMismatch")?.days, 15);
  input.animals[0].currentFieldId = "barn";
  const barnMismatch = report(input);
  assert.equal(barnMismatch.contracts[0].headDays, 0);
  assert.equal(barnMismatch.issues.find((issue) => issue.code === "currentLocationMismatch")?.days, 15);
});

test("explicit zero rate is priced, and a dated death is the final billable day", () => {
  const input = source();
  input.rates[0].rateCents = 0;
  input.animals[0].status = "expired";
  input.animals[0].currentFieldId = null;
  input.exits.push({ animalId: "cow", date: "2026-09-19" });
  const result = report(input);
  assert.equal(result.contracts[0].headDays, 4);
  assert.equal(result.contracts[0].amountCents, 0);
  assert.equal(result.hasUnpricedDays, false);
});

test("dated rates start on their effective day and continue through later months", () => {
  const input = source();
  input.animals[0].dateOfBirth = "2020-01-01";
  input.rates = [
    { contractId: "dairy", effectiveDate: "2015-01-01", rateCents: 100 },
    { contractId: "dairy", effectiveDate: "2026-09-20", rateCents: 250 },
  ];
  const september = report(input);
  assert.equal(september.contracts[0].headDays, 30);
  assert.equal(september.contracts[0].amountCents, 19 * 100 + 11 * 250);
  assert.equal(september.contracts[0].unpricedHeadDays, 0);
  const october = calculateGrazingServices(input, "2026-10", "2026-10-19");
  assert.equal(october.contracts[0].amountCents, 19 * 250);
  assert.equal(october.contracts[0].unpricedHeadDays, 0);
});
