import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ReportFilters } from "@/components/ReportFilters";
import { HerdCompositionChart } from "@/components/HerdCompositionChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

import type { Animal, Field, Property, AnimalStatus, Movement, SlaughterRecord } from "@shared/schema";
import type { AnimalTypeFilter, StatusFilter } from "@/components/ReportFilters";

interface PropertyCount {
  property: string; // display name
  propertyId?: string;
  dairy: number;
  beef: number;
  ai: number;
}

interface LatestNote {
  animalId: string;
  note: string;
  noteDate: string;
}

type GrazingTypeFilter = "all_dairy_beef" | "dairy" | "beef";

interface GrazingMonthRow {
  monthKey: string;
  monthLabel: string;
  eligibleHeadDays: number;
  grazingHeadDays: number;
  grazingDaysPerHeadDay: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NO_LOCATION_ID = "__NO_LOCATION__";
const defaultGrazingFilters = {
  excludeWet: true,
  excludeMissingDob: false,
  excludeUnderSixMonths: true,
  backfillUnknownPastures: true,
  treatUnknownPastureAsGrazing: true,
} as const;

const toUtcDay = (value?: string | Date | null): Date | null => {
  if (!value) return null;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
};

const addUtcDays = (date: Date, days: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));

const addUtcMonthsClamped = (date: Date, months: number) => {
  const baseYear = date.getUTCFullYear();
  const baseMonth = date.getUTCMonth() + months;
  const targetYear = baseYear + Math.floor(baseMonth / 12);
  const targetMonth = ((baseMonth % 12) + 12) % 12;
  const lastDayOfMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(date.getUTCDate(), lastDayOfMonth)));
};

const diffUtcDays = (start: Date, endExclusive: Date) =>
  Math.max(0, Math.round((endExclusive.getTime() - start.getTime()) / MS_PER_DAY));

const overlapUtcDays = (
  start: Date,
  endExclusive: Date,
  windowStart: Date,
  windowEndExclusive: Date,
) => {
  const overlapStart = start > windowStart ? start : windowStart;
  const overlapEnd = endExclusive < windowEndExclusive ? endExclusive : windowEndExclusive;
  return overlapEnd > overlapStart ? diffUtcDays(overlapStart, overlapEnd) : 0;
};

const normalizeTags = (tags: unknown): string[] => {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean);
  }
  return [];
};

export default function Reports() {
  // ---- Load real data ----
  const { data: animals = [], isLoading: animalsLoading } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
  });

  const { data: fields = [], isLoading: fieldsLoading } = useQuery<Field[]>({
    queryKey: ["/api/fields"],
  });

  const { data: properties = [], isLoading: propertiesLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const { data: latestNotes = [], isLoading: notesLoading } = useQuery<LatestNote[]>({
    queryKey: ["/api/notes/latest"],
  });

  const { data: allMovements = [], isLoading: movementsLoading } = useQuery<Movement[]>({
    queryKey: ["/api/movements"],
  });

  const { data: slaughterRecords = [], isLoading: slaughterLoading } = useQuery<SlaughterRecord[]>({
    queryKey: ["/api/slaughter-records"],
  });

  const isAnyLoading =
    animalsLoading || fieldsLoading || propertiesLoading || notesLoading || movementsLoading || slaughterLoading;

  // ---- Filter state ----
  const [asOfDate, setAsOfDate] = useState<string>("");
  const [animalType, setAnimalType] = useState<AnimalTypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());
  const [grazingType, setGrazingType] = useState<GrazingTypeFilter>("all_dairy_beef");
  const [excludeWet, setExcludeWet] = useState(defaultGrazingFilters.excludeWet);
  const [excludeMissingDob, setExcludeMissingDob] = useState(defaultGrazingFilters.excludeMissingDob);
  const [excludeUnderSixMonths, setExcludeUnderSixMonths] = useState(defaultGrazingFilters.excludeUnderSixMonths);
  const [backfillUnknownPastures, setBackfillUnknownPastures] = useState(defaultGrazingFilters.backfillUnknownPastures);
  const [treatUnknownPastureAsGrazing, setTreatUnknownPastureAsGrazing] = useState(defaultGrazingFilters.treatUnknownPastureAsGrazing);

  const fieldById = useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields]);
  const propertyById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  // ---- Apply filters to animals ----
  const filteredAnimals = useMemo(() => {
    if (animals.length === 0) return [];

    return animals.filter((animal) => {
      // Type filter
      if (animalType !== "all" && animal.type !== animalType) {
        return false;
      }

      // Status filter
      const aStatus = (animal as any).status as AnimalStatus | undefined;
      if (status !== "all" && aStatus !== status) {
        return false;
      }

      // Field/property selection filter
      if (selectedFieldIds.size > 0) {
        const cfId = (animal as any).currentFieldId || animal.currentFieldId;
        if (!cfId && !selectedFieldIds.has(NO_LOCATION_ID)) {
          return false;
        }
        if (cfId && !selectedFieldIds.has(cfId as string)) {
          return false;
        }
      }

      // As of Date filter – treat as "include animals born on or before this date"
      if (asOfDate) {
        const dob = (animal.dateOfBirth as any as string | null) || null;
        if (dob && dob > asOfDate) {
          // born after the as-of date -> not yet in the herd
          return false;
        }
      }

      return true;
    });
  }, [animals, fields, animalType, status, selectedFieldIds, asOfDate]);

  // ---- Herd summary from filtered animals ----
  const {
    dairyCount,
    beefCount,
    aiCount,
    totalAnimals,
    dairyPercentage,
    beefPercentage,
    aiPercentage,
  } = useMemo(() => {
    const dairy = filteredAnimals.filter((a) => String(a.type ?? "").trim().toLowerCase() === "dairy").length;
    const beef = filteredAnimals.filter((a) => String(a.type ?? "").trim().toLowerCase() === "beef").length;
    const ai = filteredAnimals.filter((a) => String(a.type ?? "").trim().toLowerCase() === "ai").length;
    const total = filteredAnimals.length;
    const dairyPct = total > 0 ? Math.round((dairy / total) * 100) : 0;
    const beefPct = total > 0 ? Math.round((beef / total) * 100) : 0;
    const aiPct = total > 0 ? Math.round((ai / total) * 100) : 0;

    return {
      dairyCount: dairy,
      beefCount: beef,
      aiCount: ai,
      totalAnimals: total,
      dairyPercentage: dairyPct,
      beefPercentage: beefPct,
      aiPercentage: aiPct,
    };
  }, [filteredAnimals]);

  // ---- Per-property breakdown from filtered animals ----
  const propertyCounts: PropertyCount[] = useMemo(() => {
    if (
      filteredAnimals.length === 0 ||
      fields.length === 0 ||
      properties.length === 0
    ) {
      return [];
    }

    const map = new Map<
      string,
      { propertyId?: string; property: string; dairy: number; beef: number; ai: number }
    >();

    for (const animal of filteredAnimals) {
      const cfId = (animal as any).currentFieldId || animal.currentFieldId;
      const field = cfId ? fieldById.get(cfId) : undefined;
      const prop = field ? propertyById.get(field.propertyId as string) : undefined;

      const key = prop?.id ?? "unassigned";
      const name = prop?.name ?? "Unassigned / No Property";

      if (!map.has(key)) {
        map.set(key, { propertyId: prop?.id, property: name, dairy: 0, beef: 0, ai: 0 });
      }

      const rec = map.get(key)!;
      const animalType = String(animal.type ?? "").trim().toLowerCase();
      if (animalType === "dairy") {
        rec.dairy += 1;
      } else if (animalType === "beef") {
        rec.beef += 1;
      } else if (animalType === "ai") {
        rec.ai += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.property.localeCompare(b.property),
    );
  }, [filteredAnimals, fieldById, propertyById]);

  const propertyChartData = useMemo(
    () =>
      propertyCounts.map((count) => ({
        ...count,
        field: count.property,
        fieldId: count.propertyId ?? count.property,
      })),
    [propertyCounts],
  );

  const filterSummary = useMemo(() => {
    const typeLabel =
      animalType === "all" ? "All" : animalType === "ai" ? "AI" : animalType.charAt(0).toUpperCase() + animalType.slice(1);
    const statusLabel =
      status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1);
    const asOfLabel = asOfDate || new Date().toISOString().split("T")[0];

    const selectedFields = Array.from(selectedFieldIds).filter((id) => id !== NO_LOCATION_ID);
    const fieldLabels = selectedFields
      .map((id) => {
        const field = fieldById.get(id);
        if (!field) return null;
        const prop = propertyById.get(field.propertyId as string);
        return prop ? `${prop.name} / ${field.name}` : field.name;
      })
      .filter(Boolean) as string[];
    if (selectedFieldIds.has(NO_LOCATION_ID)) {
      fieldLabels.push("No location");
    }
    const fieldsLabel =
      selectedFieldIds.size === 0 ? "All fields" : fieldLabels.sort((a, b) => a.localeCompare(b)).join("; ");

    return { typeLabel, statusLabel, asOfLabel, fieldsLabel };
  }, [animalType, status, asOfDate, selectedFieldIds, fieldById, propertyById]);

  const grazingReport = useMemo(() => {
    const reportEnd = toUtcDay(asOfDate || new Date()) ?? toUtcDay(new Date())!;
    const reportEndExclusive = addUtcDays(reportEnd, 1);
    const reportStart = addUtcMonthsClamped(
      new Date(Date.UTC(reportEnd.getUTCFullYear(), reportEnd.getUTCMonth(), 1)),
      -11,
    );

    const months: GrazingMonthRow[] = Array.from({ length: 12 }, (_, index) => {
      const monthStart = addUtcMonthsClamped(reportStart, index);
      const monthEndExclusive = addUtcMonthsClamped(monthStart, 1);
      return {
        monthKey: `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`,
        monthLabel: monthStart.toLocaleString("en-US", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }),
        eligibleHeadDays: 0,
        grazingHeadDays: 0,
        grazingDaysPerHeadDay: 0,
      };
    });

    const monthWindows = months.map((month, index) => ({
      month,
      start: addUtcMonthsClamped(reportStart, index),
      endExclusive: addUtcMonthsClamped(addUtcMonthsClamped(reportStart, index), 1),
    }));

    const slaughterByAnimalId = new Map(
      slaughterRecords
        .map((record) => [record.animalId, toUtcDay(record.slaughterDate)])
        .filter((entry): entry is [string, Date] => Boolean(entry[1])),
    );

    const movementsByAnimalId = new Map<string, Movement[]>();
    allMovements.forEach((movement) => {
      const list = movementsByAnimalId.get(movement.animalId) ?? [];
      list.push(movement);
      movementsByAnimalId.set(movement.animalId, list);
    });
    movementsByAnimalId.forEach((list) =>
      list.sort((a, b) => {
        const aTime = toUtcDay(a.movementDate)?.getTime() ?? 0;
        const bTime = toUtcDay(b.movementDate)?.getTime() ?? 0;
        return aTime - bTime;
      }),
    );

    let excludedMissingDob = 0;
    let includedMissingDob = 0;

    animals.forEach((animal) => {
      const normalizedType = String(animal.type ?? "").trim().toLowerCase();
      if (grazingType === "dairy" && normalizedType !== "dairy") return;
      if (grazingType === "beef" && normalizedType !== "beef") return;
      if (grazingType === "all_dairy_beef" && normalizedType !== "dairy" && normalizedType !== "beef") return;

      const normalizedTags = normalizeTags((animal as any).tags);
      if (excludeWet && normalizedTags.includes("wet")) return;

      const dob = toUtcDay(animal.dateOfBirth);
      if (!dob) {
        if (excludeMissingDob) {
          excludedMissingDob += 1;
          return;
        }
        includedMissingDob += 1;
      }

      const eligibleStart = (() => {
        if (!dob) return reportStart;
        return excludeUnderSixMonths ? addUtcMonthsClamped(dob, 6) : dob;
      })();
      const slaughterDate = slaughterByAnimalId.get(animal.id) ?? null;
      const existenceEndExclusive = slaughterDate ? slaughterDate : reportEndExclusive;
      const denominatorStart = eligibleStart > reportStart ? eligibleStart : reportStart;
      const denominatorEndExclusive =
        existenceEndExclusive < reportEndExclusive ? existenceEndExclusive : reportEndExclusive;

      if (denominatorEndExclusive <= denominatorStart) return;

      monthWindows.forEach(({ month, start, endExclusive }) => {
        month.eligibleHeadDays += overlapUtcDays(denominatorStart, denominatorEndExclusive, start, endExclusive);
      });

      const animalMovements = movementsByAnimalId.get(animal.id) ?? [];

      if (backfillUnknownPastures && animalMovements.length > 0) {
        const firstMovementStart = toUtcDay(animalMovements[0].movementDate);
        const hasKnownPasture = Boolean(animalMovements[0].toFieldId || animal.currentFieldId);
        if (firstMovementStart && hasKnownPasture) {
          const backfillEndExclusive =
            firstMovementStart < denominatorEndExclusive ? firstMovementStart : denominatorEndExclusive;
          if (backfillEndExclusive > denominatorStart) {
            monthWindows.forEach(({ month, start, endExclusive }) => {
              month.grazingHeadDays += overlapUtcDays(
                denominatorStart,
                backfillEndExclusive,
                start,
                endExclusive,
              );
            });
          }
        }
      }

      animalMovements.forEach((movement, index) => {
        const intervalStart = toUtcDay(movement.movementDate);
        if (!intervalStart || !movement.toFieldId) return;

        const nextMovementStart =
          index + 1 < animalMovements.length ? toUtcDay(animalMovements[index + 1].movementDate) : null;

        let intervalEndExclusive = nextMovementStart ?? reportEndExclusive;
        if (!nextMovementStart) {
          if (slaughterDate) {
            intervalEndExclusive = slaughterDate;
          } else if (animal.currentFieldId !== movement.toFieldId) {
            return;
          }
        }

        const grazingStart = intervalStart > eligibleStart ? intervalStart : eligibleStart;
        const grazingEndExclusive =
          intervalEndExclusive < reportEndExclusive ? intervalEndExclusive : reportEndExclusive;

        if (grazingEndExclusive <= grazingStart) return;

        monthWindows.forEach(({ month, start, endExclusive }) => {
          month.grazingHeadDays += overlapUtcDays(grazingStart, grazingEndExclusive, start, endExclusive);
        });
      });

      if (animalMovements.length === 0 && animal.currentFieldId) {
        monthWindows.forEach(({ month, start, endExclusive }) => {
          month.grazingHeadDays += overlapUtcDays(denominatorStart, denominatorEndExclusive, start, endExclusive);
        });
      }
    });

    months.forEach((month) => {
      if (treatUnknownPastureAsGrazing) {
        month.grazingHeadDays = month.eligibleHeadDays;
      }
      month.grazingDaysPerHeadDay =
        month.eligibleHeadDays > 0 ? month.grazingHeadDays / month.eligibleHeadDays : 0;
    });

    return {
      rows: months,
      reportStart,
      reportEnd,
      excludedMissingDob,
      includedMissingDob,
      totals: {
        eligibleHeadDays: months.reduce((sum, month) => sum + month.eligibleHeadDays, 0),
        grazingHeadDays: months.reduce((sum, month) => sum + month.grazingHeadDays, 0),
      },
    };
  }, [
    animals,
    allMovements,
    slaughterRecords,
    asOfDate,
    backfillUnknownPastures,
    excludeMissingDob,
    excludeUnderSixMonths,
    excludeWet,
    grazingType,
    treatUnknownPastureAsGrazing,
  ]);

  const grazingSummary = useMemo(() => {
    const ratio =
      grazingReport.totals.eligibleHeadDays > 0
        ? grazingReport.totals.grazingHeadDays / grazingReport.totals.eligibleHeadDays
        : 0;
    const typeLabel =
      grazingType === "all_dairy_beef"
        ? "All Dairy + Beef"
        : grazingType === "dairy"
        ? "Dairy"
        : "Beef";

    return {
      typeLabel,
      ratio,
      windowLabel: `${grazingReport.reportStart.toLocaleString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })} to ${grazingReport.reportEnd.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })}`,
    };
  }, [grazingReport, grazingType]);

  const resetGrazingFiltersToDefault = () => {
    setGrazingType("all_dairy_beef");
    setExcludeWet(defaultGrazingFilters.excludeWet);
    setExcludeMissingDob(defaultGrazingFilters.excludeMissingDob);
    setExcludeUnderSixMonths(defaultGrazingFilters.excludeUnderSixMonths);
    setBackfillUnknownPastures(defaultGrazingFilters.backfillUnknownPastures);
    setTreatUnknownPastureAsGrazing(defaultGrazingFilters.treatUnknownPastureAsGrazing);
  };

  const ageFromDob = (dob?: string | Date | null) => {
    if (!dob) return { years: "", months: "" };
    const d = new Date(dob as any);
    if (isNaN(d.getTime())) return { years: "", months: "" };
    const now = new Date();
    let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (now.getDate() < d.getDate()) months -= 1;
    return { years: "", months: months.toString() };
  };

  const formatAge = (dob?: string | Date | null) => {
    const { years, months } = ageFromDob(dob);
    const mNum = Number(months);
    if (isNaN(mNum)) return "";
    return `${mNum} mo`;
  };

  // ---- CSV download based on filtered data ----
  const handleDownloadReportCsv = () => {
    const sortedAnimals = [...filteredAnimals].sort((a, b) =>
      a.tagNumber.localeCompare(b.tagNumber),
    );

    const lines: string[] = [];

    lines.push("tag_number,phenotype,type,date_of_birth,age,organic,note,noteDate");
    sortedAnimals.forEach((animal) => {
      const dob = (animal.dateOfBirth as any as string) || "";
      const age = formatAge(dob || null);
      const dobValue = dob ? dob.split("T")[0] : "";
      const phenotype = (animal.phenotype || "").replace(/\"/g, '""');
      const row = [
        `"${animal.tagNumber.replace(/\"/g, '""')}"`,
        `"${phenotype}"`,
        animal.type,
        dobValue,
        `"${age}"`,
        animal.organic ? "OTCO" : "Natural",
        "", // note placeholder
        filterSummary.asOfLabel, // default noteDate (today or as-of date)
      ];
      lines.push(row.join(","));
    });

    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "herd-report.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadReportPdf = () => {
    const sortedAnimals = [...filteredAnimals].sort((a, b) =>
      a.tagNumber.localeCompare(b.tagNumber),
    );

    const asOfDateValue = asOfDate ? new Date(asOfDate) : new Date();
    const baseYear = isNaN(asOfDateValue.getTime())
      ? new Date().getFullYear()
      : asOfDateValue.getFullYear();
    const currentYear = baseYear;
    const lastYear = baseYear - 1;

    const animalById = new Map(animals.map((animal) => [animal.id, animal]));
    const noteByAnimalId = new Map(latestNotes.map((note) => [note.animalId, note.note]));
    const offspringTags = new Map<string, { current: Set<string>; last: Set<string> }>();

    animals.forEach((calf) => {
      const dob = (calf.dateOfBirth as any as string) || "";
      if (!dob || !calf.tagNumber) return;
      const year = new Date(dob).getFullYear();
      const isCurrent = year === currentYear;
      const isLast = year === lastYear;
      if (!isCurrent && !isLast) return;

      const bump = (parentId?: string | null) => {
        if (!parentId) return;
        const entry = offspringTags.get(parentId) || {
          current: new Set<string>(),
          last: new Set<string>(),
        };
        if (isCurrent) entry.current.add(calf.tagNumber);
        if (isLast) entry.last.add(calf.tagNumber);
        offspringTags.set(parentId, entry);
      };

      bump(calf.damId as string | null);
      bump(calf.sireId as string | null);
    });

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const formatDob = (dob?: string | Date | null) => {
      if (!dob) return "";
      const raw = dob as any as string;
      return raw ? raw.split("T")[0] : "";
    };

    const grouped = new Map<string, Animal[]>();
    sortedAnimals.forEach((animal) => {
      const key = (animal as any).currentFieldId || animal.currentFieldId || NO_LOCATION_ID;
      if (!grouped.has(key as string)) grouped.set(key as string, []);
      grouped.get(key as string)!.push(animal);
    });

    const groupEntries = Array.from(grouped.entries())
      .map(([fieldId, animalsInField]) => {
        const field = fieldById.get(fieldId);
        const property = field ? propertyById.get(field.propertyId as string) : undefined;
        return {
          fieldId,
          fieldName: field?.name || "No location",
          propertyName: property?.name || "",
          animals: [...animalsInField].sort((a, b) => a.tagNumber.localeCompare(b.tagNumber)),
        };
      })
      .sort((a, b) => {
        if (a.fieldId === NO_LOCATION_ID) return 1;
        if (b.fieldId === NO_LOCATION_ID) return -1;
        if (a.propertyName !== b.propertyName) return a.propertyName.localeCompare(b.propertyName);
        return a.fieldName.localeCompare(b.fieldName);
      });

    const sectionsHtml = groupEntries
      .map((group, index) => {
        const rows = group.animals
          .map((animal) => {
            const dob = (animal.dateOfBirth as any as string) || "";
            const { months } = ageFromDob(dob || null);
            const damTag = animal.damId ? animalById.get(animal.damId)?.tagNumber : "";
            const sireTag = animal.sireId ? animalById.get(animal.sireId)?.tagNumber : "";
            const tags = offspringTags.get(animal.id);
            const thisYearTags = tags ? Array.from(tags.current).sort().join(", ") : "";
            const lastYearTags = tags ? Array.from(tags.last).sort().join(", ") : "";
            const noteText = noteByAnimalId.get(animal.id) || "";
            const damSire = [damTag, sireTag].filter(Boolean).join(" / ");
            return `
              <tr>
                <td class="nowrap" style="border:1px solid #ccc;padding:2px;">${escapeHtml(animal.tagNumber)}</td>
                <td class="nowrap" style="border:1px solid #ccc;padding:2px;">${escapeHtml(animal.phenotype || "")}</td>
                <td class="nowrap" style="border:1px solid #ccc;padding:2px;">${escapeHtml(animal.sex || "")}</td>
                <td class="wrap-cell" style="border:1px solid #ccc;padding:2px;">${escapeHtml(noteText)}</td>
                <td class="nowrap" style="border:1px solid #ccc;padding:2px;">${formatDob(dob)}</td>
                <td class="nowrap" style="border:1px solid #ccc;padding:2px;text-align:center;">${months || ""}</td>
                <td class="nowrap" style="border:1px solid #ccc;padding:2px;text-align:center;">${animal.organic ? "OTCO" : "Natural"}</td>
                <td class="nowrap" style="border:1px solid #ccc;padding:2px;">${escapeHtml(damSire)}</td>
                <td class="wrap-cell" style="border:1px solid #ccc;padding:2px;">${escapeHtml(thisYearTags)}</td>
                <td class="wrap-cell" style="border:1px solid #ccc;padding:2px;">${escapeHtml(lastYearTags)}</td>
              </tr>
            `;
          })
          .join("");

        const heading = group.propertyName
          ? `${escapeHtml(group.propertyName)} / ${escapeHtml(group.fieldName)}`
          : escapeHtml(group.fieldName);
        return `
          <div class="field-section" style="page-break-inside: avoid; break-inside: avoid-page; page-break-after: auto;">
            <h3 style="margin:0 0 6px 0;">
              ${heading} <span style="font-weight:normal;">(Animals in field: ${group.animals.length})</span>
            </h3>
            <table style="border-collapse: collapse; width: 100%; font-size: 10px; line-height: 1.05; table-layout: fixed; margin-top:6px; margin-bottom:12px;">
              <thead>
                <tr>
                  <th class="nowrap" style="border:1px solid #ccc;padding:2px;text-align:left;width:8%;">Tag Number</th>
                  <th class="nowrap" style="border:1px solid #ccc;padding:2px;text-align:left;width:12%;">Phenotype</th>
                  <th class="nowrap" style="border:1px solid #ccc;padding:2px;text-align:left;width:6%;">Sex</th>
                  <th class="wrap-cell" style="border:1px solid #ccc;padding:2px;text-align:left;width:26%;">Notes</th>
                  <th class="nowrap" style="border:1px solid #ccc;padding:2px;text-align:left;width:8%;">DOB</th>
                  <th class="nowrap" style="border:1px solid #ccc;padding:2px;text-align:center;width:6%;">Age (Months)</th>
                  <th class="nowrap" style="border:1px solid #ccc;padding:2px;text-align:center;width:6%;">Organic</th>
                  <th class="nowrap" style="border:1px solid #ccc;padding:2px;text-align:left;width:10%;">Dam / Sire</th>
                  <th class="wrap-cell" style="border:1px solid #ccc;padding:2px;text-align:left;width:9%;">${currentYear} Calf</th>
                  <th class="wrap-cell" style="border:1px solid #ccc;padding:2px;text-align:left;width:9%;">${lastYear} Calf</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        `;
      })
      .join("");

    const filtersHtml = `
      <div style="margin-bottom:6px;font-size:11px;">
        <strong>Animals in report:</strong> ${sortedAnimals.length}
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <strong>As of:</strong> ${filterSummary.asOfLabel}
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <strong>Type:</strong> ${filterSummary.typeLabel}
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <strong>Status:</strong> ${filterSummary.statusLabel}
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <strong>Fields:</strong> ${filterSummary.fieldsLabel}
      </div>
    `;

    const html = `
      <html>
        <head>
          <title>Herd Report</title>
          <style>
            @page { size: landscape; margin: 6mm; }
            body, table { font-family: "Roboto", sans-serif; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
            th, td { vertical-align: top; }
            .nowrap { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .wrap-cell { white-space: normal; word-break: break-word; }
          </style>
        </head>
        <body style="padding: 8px; line-height: 1.05;">
          <h2>Herd Report</h2>
          ${filtersHtml}
          ${sectionsHtml}
          <script>window.print();</script>
        </body>
      </html>
    `;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Reports
        </h1>
        <p className="text-muted-foreground">
          Generate herd composition and historical reports
        </p>
      </div>

      {/* Filters now wired to real state + properties from DB */}
      <ReportFilters
        asOfDate={asOfDate}
        onAsOfDateChange={setAsOfDate}
        animalType={animalType}
        onAnimalTypeChange={setAnimalType}
        propertyId="all"
        onPropertyIdChange={() => {}}
        status={status}
        onStatusChange={setStatus}
        properties={properties}
        fields={fields}
        selectedFieldIds={selectedFieldIds}
        onSelectedFieldIdsChange={setSelectedFieldIds}
        onExportCsv={handleDownloadReportCsv}
        onExportPdf={handleDownloadReportPdf}
        onGenerate={undefined} // optional, everything is live-updating already
      />

      <Card>
        <CardHeader>
          <CardTitle>Applied Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
          <div><span className="text-muted-foreground">As of:</span> {filterSummary.asOfLabel}</div>
          <div><span className="text-muted-foreground">Type:</span> {filterSummary.typeLabel}</div>
          <div><span className="text-muted-foreground">Status:</span> {filterSummary.statusLabel}</div>
          <div><span className="text-muted-foreground">Fields:</span> {filterSummary.fieldsLabel}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle>Grazing Days Per Head Report</CardTitle>
              <p className="text-sm text-muted-foreground max-w-3xl">
                This section uses a rolling 12-month window ending on the As of date above. It includes only
                the selected dairy and beef animals, treats each day assigned to a field as a grazing day, and
                can optionally exclude animals missing a date of birth or animals under 6 months old. The
                monthly ratio is
                grazing head-days divided by eligible head-days, so `1.00` means every eligible head grazed every
                day in that month.
              </p>
              <p className="text-sm text-muted-foreground max-w-3xl">
                Movement dates are treated as the first day in the destination field. If an animal has no
                recorded movements but does have a current field assignment, the report assumes that assignment
                was already in place at the start of the 12-month window. When missing DOB is included, those
                animals are treated as eligible for the full report window because age cannot be determined.
                If backfill is enabled, days before the first recorded movement are counted as grazing days using
                that animal's earliest known pasture assignment. If unknown pasture days are treated as grazing,
                then any remaining eligible-but-unassigned time is also counted as grazing, which makes grazing
                head-days equal eligible head-days by design. Animals tagged `Wet` can be excluded from both the
                grazing and eligible head-day counts.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="grazing-type-filter">Type</Label>
                <Select
                  value={grazingType}
                  onValueChange={(value) => setGrazingType(value as GrazingTypeFilter)}
                >
                  <SelectTrigger id="grazing-type-filter" className="w-full min-w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_dairy_beef">All Dairy + Beef</SelectItem>
                    <SelectItem value="dairy">Dairy</SelectItem>
                    <SelectItem value="beef">Beef</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-3 text-sm font-medium cursor-pointer">
                  <Checkbox
                    checked={excludeWet}
                    onCheckedChange={(checked) => setExcludeWet(checked === true)}
                    data-testid="checkbox-grazing-exclude-wet"
                  />
                  Exclude animals tagged Wet
                </label>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-3 text-sm font-medium cursor-pointer">
                  <Checkbox
                    checked={excludeMissingDob}
                    onCheckedChange={(checked) => setExcludeMissingDob(checked === true)}
                    data-testid="checkbox-grazing-exclude-missing-dob"
                  />
                  Exclude missing date of birth
                </label>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-3 text-sm font-medium cursor-pointer">
                  <Checkbox
                    checked={excludeUnderSixMonths}
                    onCheckedChange={(checked) => setExcludeUnderSixMonths(checked === true)}
                    data-testid="checkbox-grazing-exclude-under-six-months"
                  />
                  Exclude under 6 months old
                </label>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-3 text-sm font-medium cursor-pointer">
                  <Checkbox
                    checked={backfillUnknownPastures}
                    onCheckedChange={(checked) => setBackfillUnknownPastures(checked === true)}
                    data-testid="checkbox-grazing-backfill-unknown-pastures"
                  />
                  Backfill unknown pasture dates
                </label>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-3 text-sm font-medium cursor-pointer">
                  <Checkbox
                    checked={treatUnknownPastureAsGrazing}
                    onCheckedChange={(checked) => setTreatUnknownPastureAsGrazing(checked === true)}
                    data-testid="checkbox-grazing-treat-unknown-as-grazing"
                  />
                  Treat unknown pasture days as grazing
                </label>
              </div>
              <div className="flex items-end pb-2 sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetGrazingFiltersToDefault}
                  data-testid="button-grazing-revert-default"
                >
                  Revert to Default
                </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground md:grid-cols-4">
            <div><span className="text-foreground font-medium">Window:</span> {grazingSummary.windowLabel}</div>
            <div><span className="text-foreground font-medium">Type:</span> {grazingSummary.typeLabel}</div>
            <div><span className="text-foreground font-medium">Wet Excluded:</span> {excludeWet ? "Yes" : "No"}</div>
            <div>
              <span className="text-foreground font-medium">Missing DOB Excluded:</span> {excludeMissingDob ? grazingReport.excludedMissingDob : 0}
            </div>
            <div>
              <span className="text-foreground font-medium">Missing DOB Included:</span> {excludeMissingDob ? 0 : grazingReport.includedMissingDob}
            </div>
            <div>
              <span className="text-foreground font-medium">Under 6 Months Excluded:</span> {excludeUnderSixMonths ? "Yes" : "No"}
            </div>
            <div>
              <span className="text-foreground font-medium">Backfill Unknown Pastures:</span> {backfillUnknownPastures ? "Yes" : "No"}
            </div>
            <div>
              <span className="text-foreground font-medium">Unknown Days Counted as Grazing:</span> {treatUnknownPastureAsGrazing ? "Yes" : "No"}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {movementsLoading || slaughterLoading || animalsLoading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Loading grazing report...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Eligible Head-Days</TableHead>
                  <TableHead className="text-right">Grazing Head-Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grazingReport.rows.map((row) => (
                  <TableRow key={row.monthKey}>
                    <TableCell className="font-medium">{row.monthLabel}</TableCell>
                    <TableCell className="text-right font-mono">{row.eligibleHeadDays}</TableCell>
                    <TableCell className="text-right font-mono">{row.grazingHeadDays}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold">
                  <TableCell>12-Month Total</TableCell>
                  <TableCell className="text-right font-mono">{grazingReport.totals.eligibleHeadDays}</TableCell>
                  <TableCell className="text-right font-mono">{grazingReport.totals.grazingHeadDays}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Chart uses filtered per-property counts */}
      <HerdCompositionChart
        data={propertyChartData}
        title="Number of Animals by Property"
        showPropertyLabel={false}
      />

      {/* Herd summary */}
      <Card>
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle>Herd Summary Report</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadReportCsv}
              disabled={isAnyLoading}
            >
              Download CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadReportPdf}
              disabled={isAnyLoading}
            >
              Print
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {animalsLoading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Loading report data...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Dairy Cows</TableCell>
                  <TableCell className="text-right font-mono">
                    {dairyCount}
                  </TableCell>
                  <TableCell className="text-right">
                    {dairyPercentage}%
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Beef Cattle</TableCell>
                  <TableCell className="text-right font-mono">
                    {beefCount}
                  </TableCell>
                  <TableCell className="text-right">
                    {beefPercentage}%
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">AI</TableCell>
                  <TableCell className="text-right font-mono">
                    {aiCount}
                  </TableCell>
                  <TableCell className="text-right">
                    {aiPercentage}%
                  </TableCell>
                </TableRow>
                <TableRow className="font-bold">
                  <TableCell>Total Animals</TableCell>
                  <TableCell className="text-right font-mono">
                    {totalAnimals}
                  </TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Property breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle>Property Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {isAnyLoading ? (
            <div className="flex items-center justify-center h-24">
              <p className="text-muted-foreground">
                Loading property breakdown...
              </p>
            </div>
          ) : propertyCounts.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No property herd data available.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Dairy</TableHead>
                  <TableHead className="text-right">Beef</TableHead>
                  <TableHead className="text-right">AI</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propertyCounts.map((pc) => {
                  const total = pc.dairy + pc.beef + pc.ai;
                  return (
                    <TableRow key={pc.propertyId ?? pc.property}>
                      <TableCell className="font-medium">
                        {pc.property}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {pc.dairy}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {pc.beef}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {pc.ai}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {total}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
