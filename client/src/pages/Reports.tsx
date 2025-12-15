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

  const isAnyLoading = animalsLoading || fieldsLoading || propertiesLoading;

  // ---- Filter state ----
  const [asOfDate, setAsOfDate] = useState<string>("");
const [animalType, setAnimalType] = useState<AnimalTypeFilter>("all");
const [status, setStatus] = useState<StatusFilter>("all");
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
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return { years: years.toString(), months: remMonths.toString() };
  };

  const formatAge = (dob?: string | Date | null) => {
    const { years, months } = ageFromDob(dob);
    const yNum = Number(years);
    const mNum = Number(months);
    const parts: string[] = [];
    if (!isNaN(yNum)) {
      parts.push(`${yNum} yr${yNum === 1 ? "" : "s"}`);
    }
    if (!isNaN(mNum)) {
      parts.push(`${mNum} mo`);
    }
    return parts.join(", ");
  };

  // ---- CSV download based on filtered data ----
  const handleDownloadReportCsv = () => {
    const sortedAnimals = [...filteredAnimals].sort((a, b) =>
      a.tagNumber.localeCompare(b.tagNumber),
    );

    const lines: string[] = [];

    lines.push("Filter,Value");
    lines.push(`As of Date,${filterSummary.asOfLabel}`);
    lines.push(`Type,${filterSummary.typeLabel}`);
    lines.push(`Status,${filterSummary.statusLabel}`);
    lines.push(`Fields,${filterSummary.fieldsLabel}`);
    lines.push("");

    lines.push("tag_number,phenotype,type,date_of_birth,age,organic");
    sortedAnimals.forEach((animal) => {
      const dob = (animal.dateOfBirth as any as string) || "";
      const age = formatAge(dob || null);
      const phenotype = (animal.phenotype || "").replace(/\"/g, '""');
      const row = [
        `"${animal.tagNumber.replace(/\"/g, '""')}"`,
        `"${phenotype}"`,
        animal.type,
        dob,
        `"${age}"`,
        animal.organic ? "yes" : "no",
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

    const rows = sortedAnimals
      .map((animal) => {
        const dob = (animal.dateOfBirth as any as string) || "";
        const ageLabel = formatAge(dob || null);
        return `
          <tr>
            <td style="border:1px solid #ccc;padding:4px;width:120px;"></td>
            <td style="border:1px solid #ccc;padding:4px;">${animal.tagNumber}</td>
            <td style="border:1px solid #ccc;padding:4px;">${animal.phenotype || ""}</td>
            <td style="border:1px solid #ccc;padding:4px;">${animal.type}</td>
            <td style="border:1px solid #ccc;padding:4px;">${dob ? dob.split("T")[0] : ""}</td>
            <td style="border:1px solid #ccc;padding:4px;text-align:center;">${ageLabel}</td>
            <td style="border:1px solid #ccc;padding:4px;text-align:center;">${animal.organic ? "Yes" : "No"}</td>
          </tr>
        `;
      })
      .join("");

    const filtersHtml = `
      <div style="margin-bottom:8px;font-size:12px;">
        <div><strong>As of:</strong> ${filterSummary.asOfLabel}</div>
        <div><strong>Type:</strong> ${filterSummary.typeLabel}</div>
        <div><strong>Status:</strong> ${filterSummary.statusLabel}</div>
        <div><strong>Fields:</strong> ${filterSummary.fieldsLabel}</div>
      </div>
    `;

    const html = `
      <html>
        <head>
          <title>Herd Report</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 16px;">
          <h2>Herd Report</h2>
          ${filtersHtml}
          <table style="border-collapse: collapse; width: 100%; font-size: 12px;">
            <thead>
              <tr>
                <th style="border:1px solid #ccc;padding:4px;text-align:left;">Notes</th>
                <th style="border:1px solid #ccc;padding:4px;text-align:left;">Tag Number</th>
                <th style="border:1px solid #ccc;padding:4px;text-align:left;">Phenotype</th>
                <th style="border:1px solid #ccc;padding:4px;text-align:left;">Type</th>
                <th style="border:1px solid #ccc;padding:4px;text-align:left;">Date of Birth</th>
                <th style="border:1px solid #ccc;padding:4px;text-align:center;">Age</th>
                <th style="border:1px solid #ccc;padding:4px;text-align:center;">Organic</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
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
      <HerdCompositionChart data={propertyCounts} />

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
