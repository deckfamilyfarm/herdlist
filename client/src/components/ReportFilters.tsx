import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FileDown } from "lucide-react";
import type { AnimalStatus, Field, Property } from "@shared/schema";
import { animalStatusEnum } from "@shared/schema";

export type AnimalTypeFilter = "all" | "dairy" | "beef";
export type StatusFilter = "all" | AnimalStatus;

interface ReportFiltersProps {
  asOfDate: string;
  onAsOfDateChange: (value: string) => void;

  animalType: AnimalTypeFilter;
  onAnimalTypeChange: (value: AnimalTypeFilter) => void;

  propertyId: "all" | string;
  onPropertyIdChange: (value: "all" | string) => void;

  fields: Field[];
  selectedFieldIds: Set<string>;
  onSelectedFieldIdsChange: (value: Set<string>) => void;

  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;

  properties: Property[];

  onGenerate?: () => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
}

export function ReportFilters({
  asOfDate,
  onAsOfDateChange,
  animalType,
  onAnimalTypeChange,
  propertyId: _propertyId,
  onPropertyIdChange: _onPropertyIdChange,
  fields,
  selectedFieldIds,
  onSelectedFieldIdsChange,
  status,
  onStatusChange,
  properties,
  onGenerate,
  onExportCsv,
  onExportPdf,
}: ReportFiltersProps) {
  const NO_LOCATION_ID = "__NO_LOCATION__";

  const toggleField = (fieldId: string) => {
    onSelectedFieldIdsChange(
      new Set(
        (() => {
          const next = new Set(selectedFieldIds);
          next.has(fieldId) ? next.delete(fieldId) : next.add(fieldId);
          return next;
        })(),
      ),
    );
  };

  const toggleProperty = (propertyId: string) => {
    const propertyFields = fields.filter((f) => f.propertyId === propertyId);
    const ids = propertyFields.map((f) => f.id);
    const allSelected = ids.every((id) => selectedFieldIds.has(id));

    onSelectedFieldIdsChange(
      new Set(
        (() => {
          const next = new Set(selectedFieldIds);
          if (allSelected) {
            ids.forEach((id) => next.delete(id));
          } else {
            ids.forEach((id) => next.add(id));
          }
          return next;
        })(),
      ),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* As of Date */}
          <div className="space-y-2">
            <Label htmlFor="report-date">As of Date</Label>
            <Input
              id="report-date"
              type="date"
              value={asOfDate}
              onChange={(e) => onAsOfDateChange(e.target.value)}
              data-testid="input-report-date"
            />
          </div>

          {/* Animal Type */}
          <div className="space-y-2">
            <Label htmlFor="animal-type">Animal Type</Label>
            <Select
              value={animalType}
              onValueChange={(value) =>
                onAnimalTypeChange(value as AnimalTypeFilter)
              }
            >
              <SelectTrigger
                id="animal-type"
                data-testid="select-animal-type"
              >
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="dairy">Dairy</SelectItem>
                <SelectItem value="beef">Beef</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Property / Field multi-select */}
          <div className="space-y-2">
            <Label htmlFor="property">Fields</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between" data-testid="dropdown-report-fields">
                  {selectedFieldIds.size === 0
                    ? "All fields"
                    : `${selectedFieldIds.size} selected`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72 max-h-80 overflow-y-auto">
                <DropdownMenuLabel>Fields</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onSelectedFieldIdsChange(new Set());
                  }}
                  className="flex items-center gap-2"
                >
                  <Checkbox checked={selectedFieldIds.size === 0} className="pointer-events-none" />
                  All fields
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    toggleField(NO_LOCATION_ID);
                  }}
                  className="flex items-center gap-2"
                  data-testid="checkbox-report-none"
                >
                  <Checkbox checked={selectedFieldIds.has(NO_LOCATION_ID)} className="pointer-events-none" />
                  No location
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {properties
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((prop) => {
                    const propFields = fields
                      .filter((f) => f.propertyId === prop.id)
                      .sort((a, b) => a.name.localeCompare(b.name));
                    const allPropFieldsSelected =
                      propFields.length > 0 &&
                      propFields.every((f) => selectedFieldIds.has(f.id));

                    return (
                      <div key={prop.id}>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            toggleProperty(prop.id);
                          }}
                          className="flex items-center gap-2"
                        >
                          <Checkbox checked={allPropFieldsSelected} className="pointer-events-none" />
                          {prop.name}
                        </DropdownMenuItem>
                        {propFields.map((field) => (
                          <DropdownMenuItem
                            key={field.id}
                            onSelect={(e) => {
                              e.preventDefault();
                              toggleField(field.id);
                            }}
                            className="flex items-center gap-2 pl-4"
                            data-testid={`checkbox-report-field-${field.id}`}
                          >
                            <Checkbox checked={selectedFieldIds.has(field.id)} className="pointer-events-none" />
                            {field.name}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                      </div>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Status (from enum) */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={status}
              onValueChange={(value) =>
                onStatusChange(value as StatusFilter)
              }
            >
              <SelectTrigger id="status" data-testid="select-status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {animalStatusEnum.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            data-testid="button-generate-report"
            type="button"
            onClick={() => onGenerate?.()}
          >
            Generate Report
          </Button>
          <Button
            variant="outline"
            data-testid="button-export"
            type="button"
            onClick={() => onExportCsv?.()}
          >
            <FileDown className="h-4 w-4 mr-2" />
            Export to CSV
          </Button>
          <Button
            variant="outline"
            data-testid="button-export-pdf"
            type="button"
            onClick={() => onExportPdf?.()}
          >
            Print
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
