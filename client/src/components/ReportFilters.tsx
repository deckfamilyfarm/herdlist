import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FileDown } from "lucide-react";
import type { AnimalStatus, Property } from "@shared/schema";
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

  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;

  properties: Property[];

  onGenerate?: () => void;
  onExport?: () => void;
}

export function ReportFilters({
  asOfDate,
  onAsOfDateChange,
  animalType,
  onAnimalTypeChange,
  propertyId,
  onPropertyIdChange,
  status,
  onStatusChange,
  properties,
  onGenerate,
  onExport,
}: ReportFiltersProps) {
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

          {/* Property (from DB) */}
          <div className="space-y-2">
            <Label htmlFor="property">Property</Label>
            <Select
              value={propertyId}
              onValueChange={(value) =>
                onPropertyIdChange(value as "all" | string)
              }
            >
              <SelectTrigger id="property" data-testid="select-property">
                <SelectValue placeholder="All properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            onClick={() => onExport?.()}
          >
            <FileDown className="h-4 w-4 mr-2" />
            Export to CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

