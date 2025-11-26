import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertVaccination, Vaccination } from "@shared/schema";

interface VaccinationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animalId: string;
  vaccination?: Vaccination;
}

export function VaccinationFormDialog({ open, onOpenChange, animalId, vaccination }: VaccinationFormDialogProps) {
  const { toast } = useToast();
  const isEditMode = !!vaccination;
  
  const [formData, setFormData] = useState({
    vaccineName: "",
    administeredDate: "",
    administeredBy: "",
    nextDueDate: "",
  });

  useEffect(() => {
    if (vaccination) {
      setFormData({
        vaccineName: vaccination.vaccineName || "",
        administeredDate: vaccination.administeredDate || "",
        administeredBy: vaccination.administeredBy || "",
        nextDueDate: vaccination.nextDueDate || "",
      });
    } else {
      setFormData({
        vaccineName: "",
        administeredDate: "",
        administeredBy: "",
        nextDueDate: "",
      });
    }
  }, [vaccination, open]);

  const createVaccinationMutation = useMutation({
    mutationFn: async (data: InsertVaccination) => {
      const url = isEditMode ? `/api/vaccinations/${vaccination.id}` : "/api/vaccinations";
      const method = isEditMode ? "PUT" : "POST";
      const res = await apiRequest(method, url, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vaccinations/animal', animalId] });
      toast({
        title: "Success",
        description: isEditMode ? "Vaccination updated successfully" : "Vaccination added successfully",
      });
      onOpenChange(false);
      if (!isEditMode) {
        setFormData({
          vaccineName: "",
          administeredDate: "",
          administeredBy: "",
          nextDueDate: "",
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
    const submitData: InsertVaccination = {
      animalId,
      vaccineName: formData.vaccineName,
      administeredDate: formData.administeredDate,
      administeredBy: formData.administeredBy || null,
      nextDueDate: formData.nextDueDate || null,
    };
    createVaccinationMutation.mutate(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-add-vaccination">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Vaccination" : "Add Vaccination Record"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vaccineName">Vaccine Name *</Label>
            <Input
              id="vaccineName"
              value={formData.vaccineName}
              onChange={(e) => setFormData({ ...formData, vaccineName: e.target.value })}
              required
              data-testid="input-vaccine-name"
              placeholder="e.g., BVD, Clostridial"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="administeredDate">Date Administered *</Label>
            <Input
              id="administeredDate"
              type="date"
              value={formData.administeredDate}
              onChange={(e) => setFormData({ ...formData, administeredDate: e.target.value })}
              required
              data-testid="input-administered-date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="administeredBy">Administered By (Optional)</Label>
            <Input
              id="administeredBy"
              value={formData.administeredBy}
              onChange={(e) => setFormData({ ...formData, administeredBy: e.target.value })}
              data-testid="input-administered-by"
              placeholder="Veterinarian or staff name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nextDueDate">Next Due Date (Optional)</Label>
            <Input
              id="nextDueDate"
              type="date"
              value={formData.nextDueDate}
              onChange={(e) => setFormData({ ...formData, nextDueDate: e.target.value })}
              data-testid="input-next-due-date"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              data-testid="button-cancel"
              disabled={createVaccinationMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              data-testid="button-submit"
              disabled={createVaccinationMutation.isPending}
            >
              {createVaccinationMutation.isPending ? "Saving..." : (isEditMode ? "Update" : "Add Vaccination")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
