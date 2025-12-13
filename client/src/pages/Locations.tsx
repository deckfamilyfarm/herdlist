import { PropertyWithFields } from "@/components/PropertyWithFields";
import { PropertyFormDialog } from "@/components/PropertyFormDialog";
import { FieldFormDialog } from "@/components/FieldFormDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Property, Field, Animal } from "@shared/schema";
import { useMemo, useState } from "react";

export default function Locations() {
  const [propertyDialogOpen, setPropertyDialogOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | undefined>(undefined);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<Field | undefined>(undefined);
  const [selectedPropertyIdForField, setSelectedPropertyIdForField] = useState<string | undefined>(undefined);
  const queryClient = useQueryClient();

  const { data: properties = [], isLoading: propertiesLoading } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
  });

  const { data: fields = [], isLoading: fieldsLoading } = useQuery<Field[]>({
    queryKey: ['/api/fields'],
  });

  const { data: animals = [], isLoading: animalsLoading } = useQuery<Animal[]>({
    queryKey: ['/api/animals'],
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

  const propertiesWithFields = useMemo(() => {
    return properties.map(property => {
      const propertyFields = fields.filter(field => field.propertyId === property.id);
      
      const fieldsWithCount = propertyFields.map(field => {
        const currentCount = animals.filter(animal => animal.currentFieldId === field.id).length;
        return {
          ...field,
          capacity: field.capacity ?? undefined,
          currentCount,
        };
      });
      
      return {
        ...property,
        leaseStartDate: property.leaseStartDate ?? undefined,
        leaseEndDate: property.leaseEndDate ?? undefined,
        leaseholder: property.leaseholder ?? undefined,
        fields: fieldsWithCount,
      };
    });
  }, [properties, fields, animals]);

  const handleAddProperty = () => {
    setSelectedProperty(undefined);
    setPropertyDialogOpen(true);
  };

  const handleEditProperty = (propertyId: string) => {
    const property = properties.find(p => p.id === propertyId);
    setSelectedProperty(property);
    setPropertyDialogOpen(true);
  };

  const handleAddField = (propertyId: string) => {
    setSelectedField(undefined);
    setSelectedPropertyIdForField(propertyId);
    setFieldDialogOpen(true);
  };

  const handleEditField = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    setSelectedField(field);
    setSelectedPropertyIdForField(undefined);
    setFieldDialogOpen(true);
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm("Are you sure you want to delete this field?")) return;
    await deleteFieldMutation.mutateAsync(fieldId);
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

      <div className="space-y-6">
        {propertiesWithFields.map((property) => (
          <PropertyWithFields
            key={property.id}
            property={property}
            onAddField={handleAddField}
            onEditProperty={handleEditProperty}
            onEditField={handleEditField}
            onDeleteField={handleDeleteField}
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
    </div>
  );
}
