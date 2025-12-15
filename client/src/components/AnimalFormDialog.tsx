import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertAnimal, Animal, Field, AnimalStatus, PolledStatus } from "@shared/schema";
import { animalStatusEnum, polledStatusEnum, animalTagOptions } from "@shared/schema";

interface AnimalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: any) => void;
  animal?: Animal;
}

const normalizePolledStatus = (value: any): PolledStatus => {
  if (value === "polled" || value === "horned" || value === "not tested") return value;
  if (value === true) return "polled";
  if (value === false) return "not tested";
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "polled") return "polled";
  if (normalized === "horned") return "horned";
  if (normalized === "not tested" || normalized === "not_tested" || normalized === "nottested") {
    return "not tested";
  }
  return "not tested";
};

const polledOptions: PolledStatus[] = [
  "not tested",
  ...polledStatusEnum.filter((status) => status !== "not tested"),
] as PolledStatus[];

const tagOptions = animalTagOptions;

export function AnimalFormDialog({ open, onOpenChange, onSubmit, animal }: AnimalFormDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<{
    tagNumber: string;
    type: string;
    sex: string;
    dateOfBirth: string;
    sireId: string;
    damId: string;
    currentFieldId: string;
    organic: boolean;
    phenotype: string;
    betacasein: string;
    polled: PolledStatus;
    tags: string[];
    herdName: string;
    status: AnimalStatus;
  }>({
    tagNumber: "",
    type: "",
    sex: "",
    dateOfBirth: "",
    sireId: "",
    damId: "",
    currentFieldId: "",
    organic: false,
    phenotype: "",
    betacasein: "",
    polled: "not tested",
    tags: [],
    herdName: "",
    status: "active",
  });
  const [sireOpen, setSireOpen] = useState(false);
  const [damOpen, setDamOpen] = useState(false);

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
      const normalizedSex =
        animal.sex === "male"
          ? "bull"
          : animal.sex === "female"
          ? "cow"
          : (animal.sex as string) || "";
      setFormData({
        tagNumber: animal.tagNumber,
        type: animal.type,
        sex: normalizedSex,
        dateOfBirth: animal.dateOfBirth ? new Date(animal.dateOfBirth as any).toISOString().split("T")[0] : "",
        sireId: animal.sireId || "",
        damId: animal.damId || "",
        currentFieldId: animal.currentFieldId || "",
        organic: Boolean((animal as any).organic),
        phenotype: animal.phenotype || "",
        betacasein: (animal as any).betacasein || "",
        polled: normalizePolledStatus((animal as any).polled),
        tags: Array.isArray((animal as any).tags) ? (animal as any).tags : [],
        herdName: animal.herdName || "",
        status: (animal.status as AnimalStatus) ?? "active",
      });
    } else {
      setFormData({
        tagNumber: "",
        type: "",
        sex: "",
        dateOfBirth: "",
        sireId: "",
        damId: "",
        currentFieldId: "",
        organic: false,
        phenotype: "",
        betacasein: "",
        polled: "not tested",
        tags: [],
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
      type: "",
      sex: "",
      dateOfBirth: "",
        sireId: "",
        damId: "",
        currentFieldId: "",
        organic: false,
        phenotype: "",
        betacasein: "",
        polled: "not tested",
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
      dateOfBirth: formData.dateOfBirth || undefined,
      sireId: formData.sireId || null,
      damId: formData.damId || null,
      currentFieldId: formData.currentFieldId || undefined,
      organic: Boolean(formData.organic),
      herdName: (formData.herdName || null) as
        | "wet"
        | "nurse"
        | "finish"
        | "main"
        | "grafting"
        | "yearling"
        | "missing"
        | "bull"
        | null,
      status: formData.status,
      phenotype: formData.phenotype.trim() || null,
      betacasein: formData.betacasein || null,
      polled: formData.polled || "not tested",
      tags: formData.tags,
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="dialog-add-animal">
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
                <SelectItem value="cow">Cow</SelectItem>
                <SelectItem value="bull">Bull</SelectItem>
                <SelectItem value="steer">Steer</SelectItem>
                <SelectItem value="stag">Stag</SelectItem>
                <SelectItem value="freemartin">Freemartin</SelectItem>
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
            <Popover open={sireOpen} onOpenChange={setSireOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                  data-testid="select-sire"
                >
                  {formData.sireId
                    ? (() => {
                        const match = animals.find((a) => a.id === formData.sireId);
                        return match
                          ? `${match.tagNumber}${match.phenotype ? ` (${match.phenotype})` : ""}`
                          : "Select sire";
                      })()
                    : "Select sire"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0">
                <Command>
                  <CommandInput placeholder="Search sire by tag or phenotype..." />
                  <CommandList className="max-h-64 overflow-y-auto">
                    <CommandEmpty>No sire found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                          onSelect={() => {
                            setFormData({ ...formData, sireId: "" });
                            setSireOpen(false);
                          }}
                        >
                          None
                        </CommandItem>
                        {animals
                          .filter((a) => a.sex === "bull" || a.sex === "male")
                          .slice()
                          .sort((a, b) => a.tagNumber.localeCompare(b.tagNumber))
                          .map((a) => (
                            <CommandItem
                              key={a.id}
                              value={`${a.tagNumber} ${a.phenotype ?? ""}`}
                              onSelect={() => {
                                setFormData({ ...formData, sireId: a.id });
                                setSireOpen(false);
                              }}
                            >
                            <span className="font-readable-mono">{a.tagNumber}</span>
                            {a.phenotype ? <span className="ml-2 text-muted-foreground">{a.phenotype}</span> : null}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="damId">Dam (Mother)</Label>
            <Popover open={damOpen} onOpenChange={setDamOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                  data-testid="select-dam"
                >
                  {formData.damId
                    ? (() => {
                        const match = animals.find((a) => a.id === formData.damId);
                        return match
                          ? `${match.tagNumber}${match.phenotype ? ` (${match.phenotype})` : ""}`
                          : "Select dam";
                      })()
                    : "Select dam"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0">
                <Command>
                  <CommandInput placeholder="Search dam by tag or phenotype..." />
                  <CommandList className="max-h-64 overflow-y-auto">
                    <CommandEmpty>No dam found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                          onSelect={() => {
                            setFormData({ ...formData, damId: "" });
                            setDamOpen(false);
                          }}
                        >
                          None
                        </CommandItem>
                        {animals
                          .filter((a) => a.sex === "cow" || a.sex === "female")
                          .slice()
                          .sort((a, b) => a.tagNumber.localeCompare(b.tagNumber))
                          .map((a) => (
                            <CommandItem
                              key={a.id}
                              value={`${a.tagNumber} ${a.phenotype ?? ""}`}
                              onSelect={() => {
                                setFormData({ ...formData, damId: a.id });
                                setDamOpen(false);
                              }}
                            >
                            <span className="font-readable-mono">{a.tagNumber}</span>
                            {a.phenotype ? <span className="ml-2 text-muted-foreground">{a.phenotype}</span> : null}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
          <div className="space-y-2">
            <Label htmlFor="betacasein">A2</Label>
            <Select
              value={formData.betacasein || "none"}
              onValueChange={(value) => setFormData({ ...formData, betacasein: value === "none" ? "" : value })}
            >
              <SelectTrigger id="betacasein" data-testid="select-betacasein">
                <SelectValue placeholder="Select beta-casein genotype" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not Tested</SelectItem>
                <SelectItem value="A2/A2">A2/A2</SelectItem>
                <SelectItem value="A1">A1</SelectItem>
                <SelectItem value="Not Tested">Not Tested</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="polled">Horn Status</Label>
            <Select
              value={formData.polled}
              onValueChange={(value) => setFormData({ ...formData, polled: value as PolledStatus })}
            >
              <SelectTrigger id="polled" data-testid="select-polled">
                <SelectValue placeholder="Select horn status" />
              </SelectTrigger>
              <SelectContent>
                {polledOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === "not tested"
                      ? "Not Tested"
                      : status.charAt(0).toUpperCase() + status.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {animalTagOptions.map((tag) => (
                <div key={tag} className="flex items-center space-x-2">
                  <Checkbox
                    id={`tag-${tag}`}
                    checked={formData.tags.includes(tag)}
                    onCheckedChange={(checked) => {
                      const next = new Set(formData.tags);
                      if (checked === true) {
                        next.add(tag);
                      } else {
                        next.delete(tag);
                      }
                      setFormData({ ...formData, tags: Array.from(next) });
                    }}
                    data-testid={`checkbox-tag-${tag}`}
                  />
                  <Label htmlFor={`tag-${tag}`} className="text-sm font-normal cursor-pointer capitalize">
                    {tag}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phenotype">Phenotype</Label>
            <Textarea
              id="phenotype"
              placeholder="Describe phenotype details"
              value={formData.phenotype}
              onChange={(e) => setFormData({ ...formData, phenotype: e.target.value })}
              data-testid="textarea-phenotype"
              rows={3}
            />
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
