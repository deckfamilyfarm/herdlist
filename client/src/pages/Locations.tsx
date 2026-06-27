import { PropertyWithFields } from "@/components/PropertyWithFields";
import { PropertyFormDialog } from "@/components/PropertyFormDialog";
import { FieldFormDialog } from "@/components/FieldFormDialog";
import { FieldRecordsDialog } from "@/components/FieldRecordsDialog";
import { PropertyShapeDialog } from "@/components/PropertyShapeDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Property, Field, Animal, FieldHaySummary } from "@shared/schema";
import { useMemo, useState } from "react";

const formatTotalAcres = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function Locations() {
  const [propertyDialogOpen, setPropertyDialogOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | undefined>(undefined);
  const [shapeDialogOpen, setShapeDialogOpen] = useState(false);
  const [shapeDialogTitle, setShapeDialogTitle] = useState<string | undefined>(undefined);
  const [shapeDialogGeoJson, setShapeDialogGeoJson] = useState<Record<string, unknown> | null>(null);
  const [shapeDialogBadgeLabel, setShapeDialogBadgeLabel] = useState<string | undefined>(undefined);
  const [shapeDialogEmptyMessage, setShapeDialogEmptyMessage] = useState<string | undefined>(undefined);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<Field | undefined>(undefined);
  const [selectedPropertyIdForField, setSelectedPropertyIdForField] = useState<string | undefined>(undefined);
  const [recordsDialogOpen, setRecordsDialogOpen] = useState(false);
  const [selectedRecordsField, setSelectedRecordsField] = useState<Field | undefined>(undefined);
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const { data: properties = [], isLoading: propertiesLoading } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
  });

  const { data: fields = [], isLoading: fieldsLoading } = useQuery<Field[]>({
    queryKey: ['/api/fields'],
  });

  const { data: animals = [], isLoading: animalsLoading } = useQuery<Animal[]>({
    queryKey: ['/api/animals'],
  });

  const { data: haySummaries = [] } = useQuery<FieldHaySummary[]>({
    queryKey: [`/api/hay-records?year=${currentYear}`],
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/fields/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fields'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/animals'] });
    },
    onError: (error: any) => {
      alert(error?.message || "You must remove animals from this field before deleting it");
    },
  });

  const deletePropertyMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/properties/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fields'] });
      queryClient.invalidateQueries({ queryKey: ['/api/animals'] });
    },
    onError: (error: any) => {
      alert(error?.message || "You must remove animals from this property before deleting it");
    },
  });

  const propertiesWithFields = useMemo(() => {
    const haySummaryByFieldId = new Map(haySummaries.map((summary) => [summary.fieldId, summary]));

    return properties.map(property => {
      const propertyFields = fields.filter(field => field.propertyId === property.id);
      const hayTotals = propertyFields.reduce(
        (totals, field) => {
          const summary = haySummaryByFieldId.get(field.id);
          totals.dryHayBales += summary?.dryHayBales ?? 0;
          totals.balageBales += summary?.balageBales ?? 0;
          totals.totalDmTons += summary?.totalDmTons ?? 0;
          return totals;
        },
        { dryHayBales: 0, balageBales: 0, totalDmTons: 0 },
      );
      const leasedAcres = propertyFields.reduce((sum, field) => {
        const acres = Number(field.acres);
        return sum + (Number.isFinite(acres) ? acres : 0);
      }, 0);
      const leaseRatePerAcre = Number(property.leaseRatePerAcre);
      const leaseCostPerTonDm =
        property.isLeased === "yes" &&
        Number.isFinite(leaseRatePerAcre) &&
        leaseRatePerAcre > 0 &&
        leasedAcres > 0 &&
        hayTotals.totalDmTons > 0
          ? (leaseRatePerAcre * leasedAcres) / hayTotals.totalDmTons
          : null;
      
      const fieldsWithCount = propertyFields.map(field => {
        const currentCount = animals.filter(
          (animal) => animal.currentFieldId === field.id && animal.status === "active",
        ).length;
        const assignedCount = animals.filter(animal => animal.currentFieldId === field.id).length;
        return {
          ...field,
          capacity: field.capacity ?? undefined,
          currentCount,
          assignedCount,
          haySummary: haySummaryByFieldId.get(field.id),
        };
      });
      
      return {
        ...property,
        leaseStartDate: property.leaseStartDate ?? undefined,
        leaseEndDate: property.leaseEndDate ?? undefined,
        leaseholder: property.leaseholder ?? undefined,
        hayTotals,
        leasedAcres,
        leaseCostPerTonDm,
        fields: fieldsWithCount,
      };
    });
  }, [properties, fields, animals, haySummaries]);

  const totalAcres = useMemo(() => {
    return fields.reduce((sum, field) => {
      const acres = Number(field.acres);
      return sum + (Number.isFinite(acres) ? acres : 0);
    }, 0);
  }, [fields]);

  const handleAddProperty = () => {
    setSelectedProperty(undefined);
    setPropertyDialogOpen(true);
  };

  const handleEditProperty = (propertyId: string) => {
    const property = properties.find(p => p.id === propertyId);
    setSelectedProperty(property);
    setPropertyDialogOpen(true);
  };

  const handleDeleteProperty = async (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId);
    const propertyFieldIds = new Set(
      fields.filter((field) => field.propertyId === propertyId).map((field) => field.id),
    );
    const currentAnimalCount = animals.filter(
      (animal) => animal.currentFieldId && propertyFieldIds.has(animal.currentFieldId),
    ).length;

    if (currentAnimalCount > 0) {
      alert("You must remove animals from this property before deleting it.");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${property?.name || "this property"} and all of its fields?`)) return;
    await deletePropertyMutation.mutateAsync(propertyId);
  };

  const handleAddField = (propertyId: string) => {
    setSelectedField(undefined);
    setSelectedPropertyIdForField(propertyId);
    setFieldDialogOpen(true);
  };

  const handleOpenShape = (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId);
    setShapeDialogTitle(property?.name || "Property Shape");
    setShapeDialogGeoJson((property?.boundaryGeoJson as Record<string, unknown> | null) ?? null);
    setShapeDialogBadgeLabel(property?.isLeased === "yes" ? "Leased" : undefined);
    setShapeDialogEmptyMessage("This property does not have a boundary GeoJSON yet. Edit the property and paste a polygon to view it here.");
    setShapeDialogOpen(true);
  };

  const handleOpenFieldShape = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    const property = properties.find((p) => p.id === field?.propertyId);
    setShapeDialogTitle(property ? `${property.name} - ${field?.name || "Field"}` : field?.name || "Field Shape");
    setShapeDialogGeoJson((field?.boundaryGeoJson as Record<string, unknown> | null) ?? null);
    setShapeDialogBadgeLabel("Field");
    setShapeDialogEmptyMessage("This field does not have a boundary GeoJSON yet. Edit the field and paste a polygon to view it here.");
    setShapeDialogOpen(true);
  };

  const handleEditField = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    setSelectedField(field);
    setSelectedPropertyIdForField(undefined);
    setFieldDialogOpen(true);
  };

  const handleDeleteField = async (fieldId: string) => {
    const currentAnimalCount = animals.filter((animal) => animal.currentFieldId === fieldId).length;

    if (currentAnimalCount > 0) {
      alert("You must remove animals from this field before deleting it.");
      return;
    }

    if (!confirm("Are you sure you want to delete this field?")) return;
    await deleteFieldMutation.mutateAsync(fieldId);
  };

  const handleOpenFieldRecords = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    setSelectedRecordsField(field);
    setRecordsDialogOpen(true);
  };

  if (propertiesLoading || fieldsLoading || animalsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading locations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Properties & Fields</h1>
          <p className="text-muted-foreground">Manage farm locations, fields, and lease agreements</p>
        </div>
        <Button onClick={handleAddProperty} data-testid="button-add-property">
          <Plus className="h-4 w-4 mr-2" />
          Add Property
        </Button>
      </div>

      <div className="rounded-md border bg-card px-4 py-3" data-testid="card-total-acres">
        <p className="text-sm text-muted-foreground">Total Acres</p>
        <p className="text-2xl font-semibold" data-testid="text-total-acres">
          {formatTotalAcres(totalAcres)}
        </p>
      </div>

      <div className="space-y-6">
        {propertiesWithFields.map((property) => (
          <PropertyWithFields
            key={property.id}
            property={property}
            onAddField={handleAddField}
            onEditProperty={handleEditProperty}
            onDeleteProperty={handleDeleteProperty}
            onEditField={handleEditField}
            onDeleteField={handleDeleteField}
            onOpenFieldRecords={handleOpenFieldRecords}
            onOpenShape={handleOpenShape}
            onOpenFieldShape={handleOpenFieldShape}
          />
        ))}
      </div>

      <PropertyFormDialog
        open={propertyDialogOpen}
        onOpenChange={setPropertyDialogOpen}
        property={selectedProperty}
      />

      <FieldFormDialog
        open={fieldDialogOpen}
        onOpenChange={setFieldDialogOpen}
        propertyId={selectedPropertyIdForField}
        field={selectedField}
      />

      <FieldRecordsDialog
        open={recordsDialogOpen}
        onOpenChange={setRecordsDialogOpen}
        field={selectedRecordsField}
      />

      <PropertyShapeDialog
        open={shapeDialogOpen}
        onOpenChange={setShapeDialogOpen}
        title={shapeDialogTitle}
        boundaryGeoJson={shapeDialogGeoJson}
        badgeLabel={shapeDialogBadgeLabel}
        emptyMessage={shapeDialogEmptyMessage}
      />
    </div>
  );
}
