import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertProperty, Property } from "@shared/schema";

interface PropertyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: any) => void;
  property?: Property;
}

export function PropertyFormDialog({ open, onOpenChange, onSubmit, property }: PropertyFormDialogProps) {
  const { toast } = useToast();
  const isEditMode = !!property;
  
  const [formData, setFormData] = useState({
    name: "",
    isLeased: "no",
    leaseStartDate: "",
    leaseEndDate: "",
    leaseholder: "",
  });

  useEffect(() => {
    if (property) {
      setFormData({
        name: property.name || "",
        isLeased: property.isLeased || "no",
        leaseStartDate: property.leaseStartDate || "",
        leaseEndDate: property.leaseEndDate || "",
        leaseholder: property.leaseholder || "",
      });
    } else {
      setFormData({
        name: "",
        isLeased: "no",
        leaseStartDate: "",
        leaseEndDate: "",
        leaseholder: "",
      });
    }
  }, [property, open]);

  const createPropertyMutation = useMutation({
    mutationFn: async (data: InsertProperty) => {
      const url = isEditMode ? `/api/properties/${property.id}` : "/api/properties";
      const method = isEditMode ? "PUT" : "POST";
      const res = await apiRequest(method, url, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/property-counts'] });
      toast({
        title: "Success",
        description: isEditMode ? "Property updated successfully" : "Property added successfully",
      });
      onOpenChange(false);
      if (!isEditMode) {
        setFormData({
          name: "",
          isLeased: "no",
          leaseStartDate: "",
          leaseEndDate: "",
          leaseholder: "",
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
    const submitData: InsertProperty = {
      name: formData.name,
      isLeased: formData.isLeased,
      leaseStartDate: formData.isLeased === "yes" && formData.leaseStartDate ? formData.leaseStartDate : null,
      leaseEndDate: formData.isLeased === "yes" && formData.leaseEndDate ? formData.leaseEndDate : null,
      leaseholder: formData.isLeased === "yes" && formData.leaseholder ? formData.leaseholder : null,
    };
    createPropertyMutation.mutate(submitData);
    onSubmit?.(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-add-property">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Property" : "Add New Property"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Property Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              data-testid="input-name"
            />
          </div>

          <div className="space-y-2">
            <Label>Is this property leased? *</Label>
            <RadioGroup
              value={formData.isLeased}
              onValueChange={(value) => setFormData({ ...formData, isLeased: value })}
              data-testid="radio-is-leased"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="no" data-testid="radio-is-leased-no" />
                <Label htmlFor="no" className="font-normal cursor-pointer">No</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="yes" data-testid="radio-is-leased-yes" />
                <Label htmlFor="yes" className="font-normal cursor-pointer">Yes</Label>
              </div>
            </RadioGroup>
          </div>

          {formData.isLeased === "yes" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="leaseholder">Leaseholder</Label>
                <Input
                  id="leaseholder"
                  value={formData.leaseholder}
                  onChange={(e) => setFormData({ ...formData, leaseholder: e.target.value })}
                  data-testid="input-leaseholder"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="leaseStartDate">Lease Start Date</Label>
                <Input
                  id="leaseStartDate"
                  type="date"
                  value={formData.leaseStartDate}
                  onChange={(e) => setFormData({ ...formData, leaseStartDate: e.target.value })}
                  data-testid="input-lease-start-date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="leaseEndDate">Lease End Date</Label>
                <Input
                  id="leaseEndDate"
                  type="date"
                  value={formData.leaseEndDate}
                  onChange={(e) => setFormData({ ...formData, leaseEndDate: e.target.value })}
                  data-testid="input-lease-end-date"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              data-testid="button-cancel"
              disabled={createPropertyMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              data-testid="button-submit"
              disabled={createPropertyMutation.isPending}
            >
              {createPropertyMutation.isPending ? "Saving..." : (isEditMode ? "Update Property" : "Add Property")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
