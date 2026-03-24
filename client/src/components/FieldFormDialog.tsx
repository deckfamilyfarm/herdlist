import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertField, Field, Property } from "@shared/schema";
import {
  formatPropertyBoundaryGeoJson,
  parsePropertyBoundaryGeoJson,
} from "@/lib/geojson";

interface FieldFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: any) => void;
  propertyId?: string;
  field?: Field;
}

export function FieldFormDialog({ open, onOpenChange, onSubmit, propertyId, field }: FieldFormDialogProps) {
  const { toast } = useToast();
  const isEditMode = !!field;
  const [boundaryGeoJsonText, setBoundaryGeoJsonText] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    propertyId: "",
    capacity: "",
    acres: "",
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
  });

  const { data: latestField } = useQuery<Field>({
    queryKey: [`/api/fields/${field?.id}`],
    enabled: open && isEditMode && !!field?.id,
  });

  const activeField = latestField ?? field;

  useEffect(() => {
    if (activeField) {
      setFormData({
        name: activeField.name || "",
        propertyId: activeField.propertyId || "",
        capacity: activeField.capacity?.toString() || "",
        acres: activeField.acres?.toString() || "",
      });
      setBoundaryGeoJsonText(formatPropertyBoundaryGeoJson(activeField.boundaryGeoJson));
    } else {
      setFormData({
        name: "",
        propertyId: propertyId || "",
        capacity: "",
        acres: "",
      });
      setBoundaryGeoJsonText("");
    }
  }, [activeField, propertyId, open]);

  const createFieldMutation = useMutation({
    mutationFn: async (data: InsertField) => {
      const url = isEditMode ? `/api/fields/${field.id}` : "/api/fields";
      const method = isEditMode ? "PUT" : "POST";
      const res = await apiRequest(method, url, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fields'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      if (field?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/fields/${field.id}`] });
      }
      toast({
        title: "Success",
        description: isEditMode ? "Field updated successfully" : "Field added successfully",
      });
      onOpenChange(false);
      if (!isEditMode) {
        setFormData({
          name: "",
          propertyId: propertyId || "",
          capacity: "",
          acres: "",
        });
        setBoundaryGeoJsonText("");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { geoJson, error } = parsePropertyBoundaryGeoJson(boundaryGeoJsonText);
    if (error) {
      toast({
        title: "Invalid GeoJSON",
        description: error,
        variant: "destructive",
      });
      return;
    }

    const submitData: InsertField = {
      name: formData.name,
      propertyId: formData.propertyId,
      capacity: formData.capacity ? parseInt(formData.capacity) : null,
      acres: formData.acres ? parseInt(formData.acres) : null,
      boundaryGeoJson: geoJson,
    };
    createFieldMutation.mutate(submitData);
    onSubmit?.(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-add-field">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Field" : "Add New Field"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Field Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              data-testid="input-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="propertyId">Property *</Label>
            <Select 
              value={formData.propertyId} 
              onValueChange={(value) => setFormData({ ...formData, propertyId: value })}
              required
            >
              <SelectTrigger id="propertyId" data-testid="select-property">
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity (Optional)</Label>
            <Input
              id="capacity"
              type="number"
              min="0"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              data-testid="input-capacity"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acres">Acres (Optional)</Label>
            <Input
              id="acres"
              type="number"
              min="0"
              value={formData.acres}
              onChange={(e) => setFormData({ ...formData, acres: e.target.value })}
              data-testid="input-acres"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="boundaryGeoJson">Field Boundary GeoJSON</Label>
            <Textarea
              id="boundaryGeoJson"
              value={boundaryGeoJsonText}
              onChange={(e) => setBoundaryGeoJsonText(e.target.value)}
              className="min-h-[220px] font-readable-mono text-xs sm:text-sm"
              placeholder='Paste a Polygon, MultiPolygon, Feature, or FeatureCollection here'
              data-testid="textarea-field-boundary-geojson"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank if this field does not have a mapped boundary yet.
            </p>
            <p className="text-xs text-muted-foreground">
              Need to create a boundary file? Use{" "}
              <a
                href="https://berkeleymapper.berkeley.edu"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                berkeleymapper.berkeley.edu
              </a>
              .
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              data-testid="button-cancel"
              disabled={createFieldMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              data-testid="button-submit"
              disabled={createFieldMutation.isPending}
            >
              {createFieldMutation.isPending ? "Saving..." : (isEditMode ? "Update Field" : "Add Field")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
