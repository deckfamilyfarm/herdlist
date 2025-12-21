import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ReportFilters } from "@/components/ReportFilters";
import { HerdCompositionChart } from "@/components/HerdCompositionChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

import type { Animal, Field, Property, AnimalStatus } from "@shared/schema";
import type { AnimalTypeFilter, StatusFilter } from "@/components/ReportFilters";

interface PropertyCount {
  property: string; // display name
  propertyId?: string;
  dairy: number;
  beef: number;
}

interface LatestNote {
  animalId: string;
  note: string;
  noteDate: string;
}

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

  const isAnyLoading = animalsLoading || fieldsLoading || propertiesLoading || notesLoading;

  // ---- Filter state ----
  const [asOfDate, setAsOfDate] = useState<string>("");
const [animalType, setAnimalType] = useState<AnimalTypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("active");
const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());

const NO_LOCATION_ID = "__NO_LOCATION__";

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
    totalAnimals,
    dairyPercentage,
    beefPercentage,
  } = useMemo(() => {
    const dairy = filteredAnimals.filter((a) => a.type === "dairy").length;
    const beef = filteredAnimals.filter((a) => a.type === "beef").length;
    const total = filteredAnimals.length;
    const dairyPct = total > 0 ? Math.round((dairy / total) * 100) : 0;
    const beefPct = total > 0 ? Math.round((beef / total) * 100) : 0;

    return {
      dairyCount: dairy,
      beefCount: beef,
      totalAnimals: total,
      dairyPercentage: dairyPct,
      beefPercentage: beefPct,
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
      { propertyId?: string; property: string; dairy: number; beef: number }
    >();

    for (const animal of filteredAnimals) {
      const cfId = (animal as any).currentFieldId || animal.currentFieldId;
      const field = cfId ? fieldById.get(cfId) : undefined;
      const prop = field ? propertyById.get(field.propertyId as string) : undefined;

      const key = prop?.id ?? "unassigned";
      const name = prop?.name ?? "Unassigned / No Property";

      if (!map.has(key)) {
        map.set(key, { propertyId: prop?.id, property: name, dairy: 0, beef: 0 });
      }

      const rec = map.get(key)!;
      if (animal.type === "dairy") {
        rec.dairy += 1;
      } else if (animal.type === "beef") {
        rec.beef += 1;
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
      animalType === "all" ? "All" : animalType.charAt(0).toUpperCase() + animalType.slice(1);
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
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propertyCounts.map((pc) => {
                  const total = pc.dairy + pc.beef;
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
