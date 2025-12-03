import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { InsertAnimal, Animal, Field, AnimalStatus } from "@shared/schema";
import { animalStatusEnum } from "@shared/schema";

interface AnimalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: any) => void;
  animal?: Animal;
}

export function AnimalFormDialog({ open, onOpenChange, onSubmit, animal }: AnimalFormDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<{
    tagNumber: string;
    name: string;
    type: string;
    sex: string;
    breedingMethod: string;
    dateOfBirth: string;
    sireId: string;
    damId: string;
    currentFieldId: string;
    organic: boolean;
    herdName: string;
    status: AnimalStatus;
  }>({
    tagNumber: "",
    name: "",
    type: "",
    sex: "",
    breedingMethod: "",
    dateOfBirth: "",
    sireId: "",
    damId: "",
    currentFieldId: "",
    organic: false,
    herdName: "",
    status: "active",
  });

  // Fetch animals for sire/dam selection
  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: ['/api/animals'],
  });

  // Fetch fields for location selection
  const { data: fields = [] } = useQuery<Field[]>({
    queryKey: ['/api/fields'],
  });

  useEffect(() => {
    if (animal) {
      setFormData({
        tagNumber: animal.tagNumber,
        name: animal.name || "",
        type: animal.type,
        sex: animal.sex,
        breedingMethod: animal.breedingMethod || "",
        dateOfBirth: (animal.dateOfBirth as any as string) || "",
        sireId: animal.sireId || "",
        damId: animal.damId || "",
        currentFieldId: animal.currentFieldId || "",
        organic: animal.organic || false,
        herdName: animal.herdName || "",
        status: (animal.status as AnimalStatus) ?? "active",
      });
    } else {
      setFormData({
        tagNumber: "",
        name: "",
        type: "",
        sex: "",
        breedingMethod: "",
        dateOfBirth: "",
        sireId: "",
        damId: "",
        currentFieldId: "",
        organic: false,
        herdName: "",
        status: "active",
      });
    }
  }, [animal, open]);

  const createAnimalMutation = useMutation({
    mutationFn: async (data: InsertAnimal) => {
      const res = await apiRequest("POST", "/api/animals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/animals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/property-counts'] });
      toast({
        title: "Success",
        description: "Animal added successfully",
      });
      onOpenChange(false);
      setFormData({
        tagNumber: "",
        name: "",
        type: "",
        sex: "",
        breedingMethod: "",
        dateOfBirth: "",
        sireId: "",
        damId: "",
        currentFieldId: "",
        organic: false,
        herdName: "",
        status: "active",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateAnimalMutation = useMutation({
    mutationFn: async (data: InsertAnimal) => {
      const res = await apiRequest("PUT", `/api/animals/${animal?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/animals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/property-counts'] });
      toast({
        title: "Success",
        description: "Animal updated successfully",
      });
      onOpenChange(false);
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
    const submitData: InsertAnimal = {
      tagNumber: formData.tagNumber,
      type: formData.type,
      sex: formData.sex,
      name: formData.name || undefined,
      breedingMethod: formData.breedingMethod || undefined,
      dateOfBirth: formData.dateOfBirth || undefined,
      sireId: formData.sireId || undefined,
      damId: formData.damId || undefined,
      currentFieldId: formData.currentFieldId || undefined,
      organic: formData.organic,
      herdName: (formData.herdName || undefined) as
        | "wet"
        | "nurse"
        | "finish"
        | "main"
        | "grafting"
        | "yearling"
        | "missing"
        | "bull"
        | undefined,
      status: formData.status,
    };
    
    if (animal) {
      updateAnimalMutation.mutate(submitData);
    } else {
      createAnimalMutation.mutate(submitData);
    }
    onSubmit?.(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="dialog-add-animal">
        <DialogHeader>
          <DialogTitle>{animal ? "Edit Animal" : "Add New Animal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tagNumber">Tag Number *</Label>
            <Input
              id="tagNumber"
              value={formData.tagNumber}
              onChange={(e) => setFormData({ ...formData, tagNumber: e.target.value })}
              required
              data-testid="input-tag-number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name (Optional)</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              data-testid="input-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
              <SelectTrigger id="type" data-testid="select-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dairy">Dairy</SelectItem>
                <SelectItem value="beef">Beef</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sex">Sex *</Label>
            <Select value={formData.sex} onValueChange={(value) => setFormData({ ...formData, sex: value })}>
              <SelectTrigger id="sex" data-testid="select-sex">
                <SelectValue placeholder="Select sex" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="breedingMethod">Breeding Method</Label>
            <Select
              value={formData.breedingMethod}
              onValueChange={(value) => setFormData({ ...formData, breedingMethod: value })}
            >
              <SelectTrigger id="breedingMethod" data-testid="select-breeding-method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="live-cover">Live Cover</SelectItem>
                <SelectItem value="ai">Artificial Insemination</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              data-testid="input-date-of-birth"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sireId">Sire (Father)</Label>
            <Select
              value={formData.sireId || "none"}
              onValueChange={(value) =>
                setFormData({ ...formData, sireId: value === "none" ? "" : value })
              }
            >
              <SelectTrigger id="sireId" data-testid="select-sire">
                <SelectValue placeholder="Select sire (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {animals
                  .filter((a) => a.sex === "male")
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.tagNumber} {a.name ? `(${a.name})` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="damId">Dam (Mother)</Label>
            <Select
              value={formData.damId || "none"}
              onValueChange={(value) =>
                setFormData({ ...formData, damId: value === "none" ? "" : value })
              }
            >
              <SelectTrigger id="damId" data-testid="select-dam">
                <SelectValue placeholder="Select dam (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {animals
                  .filter((a) => a.sex === "female")
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.tagNumber} {a.name ? `(${a.name})` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="currentFieldId">Current Location</Label>
            <Select
              value={formData.currentFieldId || "none"}
              onValueChange={(value) =>
                setFormData({ ...formData, currentFieldId: value === "none" ? "" : value })
              }
            >
              <SelectTrigger id="currentFieldId" data-testid="select-current-field">
                <SelectValue placeholder="Select field (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not assigned</SelectItem>
                {fields.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="herdName">Herd Name</Label>
            <Select
              value={formData.herdName || "none"}
              onValueChange={(value) =>
                setFormData({ ...formData, herdName: value === "none" ? "" : value })
              }
            >
              <SelectTrigger id="herdName" data-testid="select-herd-name">
                <SelectValue placeholder="Select herd (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="wet">Wet</SelectItem>
                <SelectItem value="nurse">Nurse</SelectItem>
                <SelectItem value="finish">Finish</SelectItem>
                <SelectItem value="main">Main</SelectItem>
                <SelectItem value="grafting">Grafting</SelectItem>
                <SelectItem value="yearling">Yearling</SelectItem>
                <SelectItem value="missing">Missing</SelectItem>
                <SelectItem value="bull">Bull</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ✅ Status selector with slaughtered disabled + note */}
          <div className="space-y-2">
            <Label htmlFor="status">Status *</Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value as AnimalStatus })
              }
            >
              <SelectTrigger id="status" data-testid="select-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {animalStatusEnum.map((status) => {
                  if (status === "slaughtered") {
                    return (
                      <SelectItem key={status} value={status} disabled>
                        Slaughtered (use Slaughtered Form)
                      </SelectItem>
                    );
                  }
                  return (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              To mark an animal as slaughtered, use the dedicated Slaughtered Form screen.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="organic" 
              checked={formData.organic} 
              onCheckedChange={(checked) => setFormData({ ...formData, organic: checked === true })}
              data-testid="checkbox-organic"
            />
            <Label htmlFor="organic" className="text-sm font-normal cursor-pointer">
              Organic
            </Label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" data-testid="button-submit">
              {animal ? "Update Animal" : "Add Animal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

