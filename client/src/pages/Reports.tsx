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

import type {
  Animal,
  Field,
  Property,
  AnimalStatus,
} from "@shared/schema";
import type {
  AnimalTypeFilter,
  StatusFilter,
} from "@/components/ReportFilters";

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

  const { data: properties = [], isLoading: propertiesLoading } =
    useQuery<Property[]>({
      queryKey: ["/api/properties"],
    });

  const isAnyLoading = animalsLoading || fieldsLoading || propertiesLoading;

  // ---- Filter state ----
  const [asOfDate, setAsOfDate] = useState<string>("");
  const [animalType, setAnimalType] = useState<AnimalTypeFilter>("all");
  const [propertyId, setPropertyId] = useState<"all" | string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  // ---- Apply filters to animals ----
  const filteredAnimals = useMemo(() => {
    if (animals.length === 0) return [];

    const fieldById = new Map(fields.map((f) => [f.id, f]));

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

      // Property filter
      if (propertyId !== "all") {
        const cfId = (animal as any).currentFieldId || animal.currentFieldId;
        if (!cfId) return false;
        const f = fieldById.get(cfId);
        if (!f) return false;
        if ((f.propertyId as string) !== propertyId) {
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
  }, [animals, fields, animalType, status, propertyId, asOfDate]);

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

    const fieldById = new Map(fields.map((f) => [f.id, f]));
    const propertyById = new Map(properties.map((p) => [p.id, p]));

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
  }, [filteredAnimals, fields, properties]);

  // ---- CSV download based on filtered data ----
  const handleDownloadReport = () => {
    const lines: string[] = [];

    // Summary
    lines.push("Section,Category,Count,Percentage");
    lines.push(`Summary,Dairy Cows,${dairyCount},${dairyPercentage}`);
    lines.push(`Summary,Beef Cattle,${beefCount},${beefPercentage}`);
    lines.push(`Summary,Total Animals,${totalAnimals},100`);
    lines.push("");

    // Property breakdown
    lines.push("Section,Property,Dairy,Beef,Total");
    if (propertyCounts.length === 0) {
      lines.push("Property Breakdown,No property data,0,0,0");
    } else {
      for (const pc of propertyCounts) {
        const total = pc.dairy + pc.beef;
        const propName = `"${pc.property.replace(/"/g, '""')}"`;
        lines.push(
          `Property Breakdown,${propName},${pc.dairy},${pc.beef},${total}`,
        );
      }
    }

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
        propertyId={propertyId}
        onPropertyIdChange={setPropertyId}
        status={status}
        onStatusChange={setStatus}
        properties={properties}
        onExport={handleDownloadReport}
        onGenerate={undefined} // optional, everything is live-updating already
      />

      {/* Chart uses filtered per-property counts */}
      <HerdCompositionChart data={propertyCounts} />

      {/* Herd summary */}
      <Card>
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle>Herd Summary Report</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadReport}
            disabled={isAnyLoading}
          >
            Download CSV
          </Button>
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

