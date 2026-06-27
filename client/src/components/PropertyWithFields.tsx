import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Plus, Edit, Trash2, ClipboardList, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Field {
  id: string;
  name: string;
  capacity?: number;
  currentCount: number;
  assignedCount: number;
  acres?: number | string | null;
  certifiedOrganic?: boolean | null;
  haySummary?: {
    tonDmPerAcre: number | null;
  };
  boundaryGeoJson?: Record<string, unknown> | null;
}

interface Property {
  id: string;
  name: string;
  isLeased: string;
  leaseStartDate?: string | Date;
  leaseEndDate?: string | Date;
  leaseholder?: string;
  leaseRatePerAcre?: number | string | null;
  leasedAcres?: number;
  leaseCostPerTonDm?: number | null;
  boundaryGeoJson?: Record<string, unknown> | null;
  hayTotals?: {
    dryHayBales: number;
    balageBales: number;
    totalDmTons: number;
  };
  fields: Field[];
}

interface PropertyWithFieldsProps {
  property: Property;
  onAddField?: (propertyId: string) => void;
  onEditProperty?: (propertyId: string) => void;
  onDeleteProperty?: (propertyId: string) => void;
  onEditField?: (fieldId: string) => void;
  onDeleteField?: (fieldId: string) => void;
  onOpenFieldRecords?: (fieldId: string) => void;
  onOpenShape?: (propertyId: string) => void;
  onOpenFieldShape?: (fieldId: string) => void;
}

const formatDateDisplay = (value: string | Date | undefined) => {
  if (!value) return "";
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
};

const formatAcresDisplay = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "-";

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : value;
};

const formatTonDmPerAcre = (value: number | null | undefined) => {
  return Number.isFinite(value) ? Number(value).toFixed(2) : "-";
};

const formatBales = (value: number) => {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
};

const formatCurrency = (value: number | string | null | undefined) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? numericValue.toLocaleString(undefined, { style: "currency", currency: "USD" })
    : "-";
};

export function PropertyWithFields({ 
  property, 
  onAddField, 
  onEditProperty,
  onDeleteProperty,
  onEditField,
  onDeleteField,
  onOpenFieldRecords,
  onOpenShape,
  onOpenFieldShape,
}: PropertyWithFieldsProps) {
  const [fieldsExpanded, setFieldsExpanded] = useState(false);
  const totalAnimals = property.fields.reduce((sum, field) => sum + field.currentCount, 0);
  const totalAssignedAnimals = property.fields.reduce((sum, field) => sum + field.assignedCount, 0);
  const totalCapacity = property.fields.reduce((sum, field) => sum + (field.capacity || 0), 0);
  const totalAcres = property.fields.reduce((sum, field) => {
    const acres = Number(field.acres);
    return sum + (Number.isFinite(acres) ? acres : 0);
  }, 0);

  return (
    <Card className="transition-colors hover:bg-muted/20" data-testid={`card-property-${property.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-4">
        <div
          className="flex-1 cursor-pointer"
          onClick={() => onOpenShape?.(property.id)}
        >
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-chart-1" />
            <CardTitle className="text-lg">{property.name}</CardTitle>
            {property.isLeased === "yes" && (
              <Badge variant="secondary" data-testid={`badge-leased-${property.id}`}>Leased</Badge>
            )}
            {property.boundaryGeoJson && (
              <Badge variant="outline">Mapped</Badge>
            )}
          </div>
          {property.isLeased === "yes" && property.leaseholder && (
            <div className="mt-2 ml-8">
              <p className="text-sm text-muted-foreground">
                Leaseholder: <span className="font-medium text-foreground">{property.leaseholder}</span>
              </p>
              {(property.leaseStartDate || property.leaseEndDate) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {formatDateDisplay(property.leaseStartDate)} - {formatDateDisplay(property.leaseEndDate)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onEditProperty?.(property.id);
            }}
            aria-label={`Edit ${property.name}`}
            data-testid={`button-edit-property-${property.id}`}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={totalAssignedAnimals > 0}
            title={
              totalAssignedAnimals > 0
                ? "Move all animals off this property before deleting it."
                : `Delete ${property.name}`
            }
            onClick={(event) => {
              event.stopPropagation();
              onDeleteProperty?.(property.id);
            }}
            aria-label={`Delete ${property.name}`}
            data-testid={`button-delete-property-${property.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div
            className="flex flex-wrap cursor-pointer gap-x-6 gap-y-2 text-sm"
            onClick={() => onOpenShape?.(property.id)}
          >
            <div>
              <p className="text-muted-foreground">Total Fields</p>
              <p className="font-semibold text-lg" data-testid={`text-field-count-${property.id}`}>
                {property.fields.length}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Acres</p>
              <p className="font-semibold text-lg" data-testid={`text-total-acres-${property.id}`}>
                {formatAcresDisplay(totalAcres)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Animals</p>
              <p className="font-semibold text-lg" data-testid={`text-animal-count-${property.id}`}>
                {totalAnimals}
              </p>
            </div>
            {(property.hayTotals?.dryHayBales ?? 0) > 0 && (
              <div>
                <p className="text-muted-foreground">Total Dry Hay Bales</p>
                <p className="font-semibold text-lg">
                  {formatBales(property.hayTotals?.dryHayBales ?? 0)}
                </p>
              </div>
            )}
            {(property.hayTotals?.balageBales ?? 0) > 0 && (
              <div>
                <p className="text-muted-foreground">Total Balage</p>
                <p className="font-semibold text-lg">
                  {formatBales(property.hayTotals?.balageBales ?? 0)}
                </p>
              </div>
            )}
            {totalCapacity > 0 && (
              <div>
                <p className="text-muted-foreground">Capacity</p>
                <p className="font-semibold text-lg">
                  {totalCapacity}
                </p>
              </div>
            )}
            {property.isLeased === "yes" && property.leaseCostPerTonDm !== null && property.leaseCostPerTonDm !== undefined && (
              <div>
                <p className="text-muted-foreground">$ / Ton DM</p>
                <p className="font-semibold text-lg">
                  {formatCurrency(property.leaseCostPerTonDm)}
                </p>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {property.fields.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation();
                  setFieldsExpanded((expanded) => !expanded);
                }}
                aria-expanded={fieldsExpanded}
                data-testid={`button-toggle-fields-${property.id}`}
              >
                {fieldsExpanded ? (
                  <ChevronDown className="h-4 w-4 mr-2" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
                {fieldsExpanded ? "Hide Fields" : `Show Fields (${property.fields.length})`}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                onAddField?.(property.id);
              }}
              data-testid={`button-add-field-${property.id}`}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
          </div>
        </div>

        {fieldsExpanded && property.fields.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field Name</TableHead>
                  <TableHead>Animals</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Acres</TableHead>
                  <TableHead>Organic</TableHead>
                  <TableHead>Ton DM/Acre</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {property.fields.map((field) => {
                  return (
                    <TableRow
                      key={field.id}
                      className={field.boundaryGeoJson ? "cursor-pointer" : undefined}
                      onClick={
                        field.boundaryGeoJson
                          ? (event) => {
                              event.stopPropagation();
                              onOpenFieldShape?.(field.id);
                            }
                          : undefined
                      }
                      data-testid={`row-field-${field.id}`}
                    >
                      <TableCell className="font-medium">
                        {field.boundaryGeoJson ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto min-h-0 p-0 font-medium text-foreground hover:bg-transparent"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenFieldShape?.(field.id);
                            }}
                            data-testid={`button-open-field-name-${field.id}`}
                          >
                            {field.name}
                          </Button>
                        ) : (
                          field.name
                        )}
                      </TableCell>

                      <TableCell className="font-mono" data-testid={`text-current-count-${field.id}`}>
                        {field.currentCount}
                      </TableCell>
                      <TableCell className="font-mono">
                        {field.capacity || '-'}
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatAcresDisplay(field.acres)}
                      </TableCell>
                      <TableCell>
                        {field.certifiedOrganic ? (
                          <Badge variant="secondary">Certified</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatTonDmPerAcre(field.haySummary?.tonDmPerAcre)}
                      </TableCell>
                      <TableCell className="text-right">
                        {field.boundaryGeoJson && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary underline underline-offset-2"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenFieldShape?.(field.id);
                            }}
                            data-testid={`button-view-field-shape-${field.id}`}
                          >
                            Mapped
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenFieldRecords?.(field.id);
                          }}
                          data-testid={`button-field-records-${field.id}`}
                        >
                          <ClipboardList className="h-4 w-4" />
                          Records
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEditField?.(field.id);
                          }}
                          data-testid={`button-edit-field-${field.id}`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={field.assignedCount > 0}
                          title={
                            field.assignedCount > 0
                              ? "Move all animals out of this field before deleting it."
                              : `Delete ${field.name}`
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteField?.(field.id);
                          }}
                          data-testid={`button-delete-field-${field.id}`}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
