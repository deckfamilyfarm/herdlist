export type ServiceAnimal = {
  id: string; tagNumber: string; type: string; sex: string;
  phenotype: string | null; status: string;
  dateOfBirth: string | null; currentFieldId: string | null;
  inactiveSince?: string | null;
};
export type ServiceField = { id: string; name: string };
export type ServiceMovement = {
  id: string; animalId: string; fromFieldId: string | null; toFieldId: string | null;
  movementDate: string; createdAt: string;
};
export type ServiceOwnership = { animalId: string; ownerId: string; effectiveDate: string };
export type ServiceExit = { animalId: string; date: string };
export type ServiceContract = {
  id: string; name: string; ownerId: string; ownerName: string;
  kind: "dairy" | "general"; activeFrom: string; activeTo: string | null;
  dairyBarnFieldId: string | null;
};
export type ServiceRate = {
  contractId: string; effectiveDate: string; rateCents: number;
  seasonStartMonth?: number | null; seasonEndMonth?: number | null;
  ageThresholdMonths?: number | null; olderRateCents?: number | null;
  youngerRateCents?: number | null; freeUnderMonths?: number | null;
};
export type ServiceAssignment = {
  id: string; contractId: string; animalId: string; startDate: string; endDate: string | null;
};
export type ServiceSource = {
  animals: ServiceAnimal[]; fields: ServiceField[]; movements: ServiceMovement[];
  ownership: ServiceOwnership[]; exits: ServiceExit[];
  contracts: ServiceContract[]; assignments: ServiceAssignment[]; rates: ServiceRate[];
};
export type ServiceIssueCode =
  | "overlap" | "unknownOwner" | "unknownLocation"
  | "historyConflict" | "currentLocationMismatch"
  | "ownerMismatch" | "missingBarnField";
export type ServiceIssue = {
  animalId: string; tagNumber: string; code: ServiceIssueCode;
  firstDate: string; lastDate: string; days: number; contractIds: string[];
};
export type ServiceRow = {
  animalId: string; tagNumber: string; phenotype: string | null;
  type: string; sex: string; dateOfBirth: string | null;
  headDays: number; amountCents: number; unpricedHeadDays: number;
};
export type ServiceContractReport = ServiceContract & {
  headDays: number; amountCents: number; unpricedHeadDays: number; rows: ServiceRow[];
};
export type ServiceReport = {
  month: string; throughDate: string; contracts: ServiceContractReport[];
  issues: ServiceIssue[]; totalAmountCents: number; hasUnpricedDays: boolean;
};

export function isServiceDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export function addServiceDays(value: string, days: number): string {
  const result = new Date(`${value}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
export function addServiceMonths(value: string, months: number): string {
  const date = new Date(`${value.slice(0, 7)}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(date.getTime());
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  date.setUTCDate(Math.min(Number(value.slice(8, 10)), last.getUTCDate()));
  return date.toISOString().slice(0, 10);
}
export function isServiceMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value) && isServiceDate(`${value}-01`);
}
export function serviceToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function serviceRateCentsOnDay(rate: ServiceRate, day: string, birthDate: string | null): number {
  const { seasonStartMonth: first, seasonEndMonth: last, ageThresholdMonths: threshold,
    olderRateCents: older, youngerRateCents: younger, freeUnderMonths: freeUnder } = rate;
  if (freeUnder != null && (!Number.isInteger(freeUnder) || freeUnder < 1 || freeUnder > 240))
    throw new Error(`Invalid free age cutoff effective ${rate.effectiveDate}`);
  const seasonal = [first, last, threshold, older, younger];
  const hasSeason = seasonal.some((value) => value != null);
  if (hasSeason && (seasonal.some((value) => value == null) ||
    !Number.isInteger(first) || first! < 1 || first! > 12 ||
    !Number.isInteger(last) || last! < 1 || last! > 12 ||
    !Number.isInteger(threshold) || threshold! < 1 || threshold! > 240 ||
    !Number.isInteger(older) || older! < 0 ||
    !Number.isInteger(younger) || younger! < 0))
    throw new Error(`Incomplete or invalid seasonal rate effective ${rate.effectiveDate}`);
  if (hasSeason && freeUnder != null && freeUnder > threshold!)
    throw new Error(`Free age cutoff exceeds seasonal threshold effective ${rate.effectiveDate}`);
  if (freeUnder != null && birthDate && day < addServiceMonths(birthDate, freeUnder)) return 0;
  if (!hasSeason) return rate.rateCents;
  const month = Number(day.slice(5, 7));
  const inSeason = first! <= last! ? month >= first! && month <= last! : month >= first! || month <= last!;
  if (!inSeason) return rate.rateCents;
  // An unknown birth date is treated as older than one year, as in dairy eligibility.
  return !birthDate || day > addServiceMonths(birthDate, threshold!) ? older! : younger!;
}

type Transition = { day: string; to: string | null; destinations: (string | null)[]; conflict: boolean };
function transitionsFor(movements: ServiceMovement[]): Transition[] {
  const sorted = [...movements].sort((a, b) =>
    Date.parse(a.movementDate) - Date.parse(b.movementDate) ||
    Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
  const byDay = new Map<string, ServiceMovement[]>();
  for (const move of sorted) {
    const day = move.movementDate.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) || []), move]);
  }
  const result: Transition[] = [];
  for (const [day, moves] of Array.from(byDay.entries())) {
    result.push({
      day,
      to: moves.at(-1)!.toFieldId,
      destinations: moves.map((move) => move.toFieldId),
      conflict: moves.some((move, i) => i > 0 &&
        move.movementDate === moves[i - 1].movementDate &&
        move.createdAt === moves[i - 1].createdAt &&
        move.toFieldId !== moves[i - 1].toFieldId),
    });
  }
  return result;
}

export function calculateGrazingServices(source: ServiceSource, month: string, today = serviceToday()): ServiceReport {
  if (!isServiceMonth(month) || month > today.slice(0, 7)) throw new Error("Invalid report month");
  const start = `${month}-01`;
  const end = addServiceDays(addServiceMonths(start, 1), -1);
  const throughDate = end < today ? end : today;
  const fields = new Map(source.fields.map((field) => [field.id, field.name.trim().toLowerCase()]));
  function outsideDairyBarn(fieldId: string | null, barnFieldId: string | null): boolean {
    const name = fieldId ? fields.get(fieldId) : null;
    return Boolean(name && name !== "missing" && name !== "dairy barn" && fieldId !== barnFieldId);
  }
  const owners = new Map<string, ServiceOwnership[]>();
  for (const entry of source.ownership) owners.set(entry.animalId, [...(owners.get(entry.animalId) || []), entry]);
  for (const list of Array.from(owners.values())) list.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  const moves = new Map<string, ServiceMovement[]>();
  for (const move of source.movements) moves.set(move.animalId, [...(moves.get(move.animalId) || []), move]);
  const exits = new Map<string, string>();
  for (const exit of source.exits) {
    const date = exit.date.slice(0, 10);
    if (!exits.has(exit.animalId) || date < exits.get(exit.animalId)!) exits.set(exit.animalId, date);
  }
  const assignments = new Map<string, ServiceAssignment[]>();
  for (const assignment of source.assignments)
    assignments.set(assignment.animalId, [...(assignments.get(assignment.animalId) || []), assignment]);
  const rates = new Map<string, ServiceRate[]>();
  for (const rate of source.rates)
    rates.set(rate.contractId, [...(rates.get(rate.contractId) || []), rate]);
  for (const list of Array.from(rates.values())) list.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  function rateOn(contractId: string, day: string): ServiceRate | null {
    const list = rates.get(contractId) || [];
    for (let index = list.length - 1; index >= 0; index--)
      if (list[index].effectiveDate <= day) return list[index];
    return null;
  }
  const contractReports: ServiceContractReport[] = source.contracts.map((contract) => ({
    ...contract, headDays: 0, amountCents: 0, unpricedHeadDays: 0, rows: [],
  }));
  const rowMaps = new Map(contractReports.map((contract) => [contract.id, new Map<string, ServiceRow>()]));
  const issues = new Map<string, ServiceIssue>();
  function issue(animal: ServiceAnimal, day: string, code: ServiceIssueCode, contractIds: string[]) {
    const ids = [...contractIds].sort();
    const key = `${animal.id}|${code}|${ids.join(",")}`;
    const prior = issues.get(key);
    if (prior) { prior.days++; prior.lastDate = day; }
    else issues.set(key, { animalId: animal.id, tagNumber: animal.tagNumber, code,
      firstDate: day, lastDate: day, days: 1, contractIds: ids });
  }
  for (const animal of source.animals) {
    const exit = exits.get(animal.id);
    // "Inactive since" is the first excluded day; known exits are last included days.
    const inactiveSince = animal.status === "inactive" && animal.inactiveSince && isServiceDate(animal.inactiveSince)
      ? animal.inactiveSince : null;
    const birthDate = animal.dateOfBirth && isServiceDate(animal.dateOfBirth)
      ? animal.dateOfBirth : null;
    const relevant = contractReports.filter((contract) =>
      contract.kind === "dairy" ? animal.type.trim().toLowerCase() === "dairy" :
        (assignments.get(animal.id) || []).some((assignment) => assignment.contractId === contract.id));
    if (!relevant.length) continue;
    if (animal.status !== "active" && !exit && !inactiveSince) continue;
    const history = transitionsFor(moves.get(animal.id) || []);
    let locationIndex = -1;
    const ownerHistory = owners.get(animal.id) || [];
    let ownerIndex = -1;
    for (let day = start; day <= throughDate && (!exit || day <= exit) &&
      (!inactiveSince || day < inactiveSince); day = addServiceDays(day, 1)) {
      if (birthDate && day < birthDate) continue;
      while (locationIndex + 1 < history.length && history[locationIndex + 1].day <= day) locationIndex++;
      while (ownerIndex + 1 < ownerHistory.length && ownerHistory[ownerIndex + 1].effectiveDate <= day) ownerIndex++;
      const ownerId = ownerHistory[ownerIndex]?.ownerId;
      const candidates: ServiceContractReport[] = [];
      for (const contract of relevant) {
        if (day < contract.activeFrom || (contract.activeTo && day > contract.activeTo)) continue;
        if (contract.kind === "general" && !(assignments.get(animal.id) || []).some((a) =>
          a.contractId === contract.id && a.startDate <= day && (!a.endDate || day <= a.endDate))) continue;
        // Historic dairy rates excluded young animals. A dated free cutoff lists
        // their pasture days at $0 and begins charging at the cutoff anniversary.
        const activeRate = rateOn(contract.id, day);
        if (contract.kind === "dairy" && birthDate && activeRate?.freeUnderMonths == null &&
          day <= addServiceMonths(birthDate, 6)) continue;
        if (!ownerId) issue(animal, day, "unknownOwner", [contract.id]);
        else if (ownerId !== contract.ownerId) issue(animal, day, "ownerMismatch", [contract.id]);
        if (contract.kind === "dairy") {
          if (!contract.dairyBarnFieldId) issue(animal, day, "missingBarnField", [contract.id]);
          const movement = history[locationIndex];
          if (movement?.conflict) issue(animal, day, "historyConflict", [contract.id]);
          const recordedLocation = movement?.to && fields.has(movement.to) ? movement.to : null;
          if (!recordedLocation) issue(animal, day, "unknownLocation", [contract.id]);
          if (movement && locationIndex === history.length - 1 && !exit && animal.currentFieldId !== movement.to) {
            issue(animal, day, "currentLocationMismatch", [contract.id]);
            const currentLocation = animal.currentFieldId ? fields.get(animal.currentFieldId) : null;
            if (currentLocation === "missing" || currentLocation === "dairy barn" ||
              animal.currentFieldId === contract.dairyBarnFieldId) continue;
          }
          const locationFieldId = recordedLocation || animal.currentFieldId;
          if (!outsideDairyBarn(locationFieldId, contract.dairyBarnFieldId)) continue;
          if (movement?.conflict && !movement.destinations.every((fieldId) =>
            outsideDairyBarn(fieldId, contract.dairyBarnFieldId))) continue;
        }
        candidates.push(contract);
      }
      if (candidates.length > 1) {
        issue(animal, day, "overlap", candidates.map((contract) => contract.id));
        candidates.sort((a, b) =>
          Number(b.kind === "dairy") - Number(a.kind === "dairy") ||
          a.activeFrom.localeCompare(b.activeFrom) || a.id.localeCompare(b.id));
      }
      const contract = candidates[0];
      if (!contract) continue;
      const rows = rowMaps.get(contract.id)!;
      const row = rows.get(animal.id) || {
        animalId: animal.id, tagNumber: animal.tagNumber, phenotype: animal.phenotype,
        type: animal.type, sex: animal.sex, dateOfBirth: animal.dateOfBirth,
        headDays: 0, amountCents: 0, unpricedHeadDays: 0,
      };
      row.headDays++;
      rows.set(animal.id, row);
      contract.headDays++;
      const rate = rateOn(contract.id, day);
      if (rate === null) {
        row.unpricedHeadDays++;
        contract.unpricedHeadDays++;
      } else {
        const rateCents = serviceRateCentsOnDay(rate, day, birthDate);
        row.amountCents += rateCents;
        contract.amountCents += rateCents;
      }
    }
  }
  for (const contract of contractReports) {
    contract.rows = Array.from(rowMaps.get(contract.id)!.values()).sort((a, b) => a.tagNumber.localeCompare(b.tagNumber));
  }
  return {
    month, throughDate, contracts: contractReports,
    issues: Array.from(issues.values()).sort((a, b) => a.tagNumber.localeCompare(b.tagNumber) || a.firstDate.localeCompare(b.firstDate)),
    totalAmountCents: contractReports.reduce((sum, contract) => sum + contract.amountCents, 0),
    hasUnpricedDays: contractReports.some((contract) => contract.unpricedHeadDays > 0),
  };
}
