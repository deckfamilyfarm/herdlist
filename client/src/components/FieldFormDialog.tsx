import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  
  const [formData, setFormData] = useState({
    name: "",
    propertyId: "",
    capacity: "",
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
  });

  useEffect(() => {
    if (field) {
      setFormData({
        name: field.name || "",
        propertyId: field.propertyId || "",
        capacity: field.capacity?.toString() || "",
      });
    } else {
      setFormData({
        name: "",
        propertyId: propertyId || "",
        capacity: "",
      });
    }
  }, [field, propertyId, open]);

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
        });
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
    const submitData: InsertField = {
      name: formData.name,
      propertyId: formData.propertyId,
      capacity: formData.capacity ? parseInt(formData.capacity) : null,
    };
    createFieldMutation.mutate(submitData);
    onSubmit?.(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-add-field">
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
