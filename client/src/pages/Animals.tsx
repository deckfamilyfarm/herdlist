import { AnimalTable } from "@/components/AnimalTable";
import { AnimalFormDialog } from "@/components/AnimalFormDialog";
import { AnimalDetailDialog } from "@/components/AnimalDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { animalStatusEnum, type Animal, type AnimalStatus, type Field } from "@shared/schema";

type StatusFilter = "all" | AnimalStatus;
type BooleanFilter = "all" | "yes" | "no";
type BetacaseinFilter = "all" | "A2/A2" | "A1" | "Not Tested";

export default function Animals() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "dairy" | "beef">("all");
  const [sexFilter, setSexFilter] = useState<"all" | "cow" | "bull" | "steer" | "stag" | "freemartin">("all");
  const [polledFilter, setPolledFilter] = useState<BooleanFilter>("all");
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active"); // default "active"
  const [betacaseinFilter, setBetacaseinFilter] = useState<BetacaseinFilter>("all");

  const { data: animals = [], isLoading } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
  });

  const { data: fields = [] } = useQuery<Field[]>({
    queryKey: ['/api/fields'],
  });

  const deleteAnimalMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/animals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/animals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/property-counts"] });
      toast({
        title: "Success",
        description: "Animal deleted successfully",
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

  const handleViewAnimal = (id: string) => {
    const animal = animals.find((a) => a.id === id);
    if (animal) {
      setSelectedAnimal(animal);
      setDetailDialogOpen(true);
    }
  };

  const handleEditAnimal = (id: string) => {
    const animal = animals.find((a) => a.id === id);
    if (animal) {
      setEditingAnimal(animal);
      setDialogOpen(true);
    }
  };

  const handleDeleteAnimal = (id: string) => {
    if (confirm("Are you sure you want to delete this animal?")) {
      deleteAnimalMutation.mutate(id);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingAnimal(null);
    }
  };

  // ---------- Filtering logic ----------
  const searchLower = searchTerm.trim().toLowerCase();

  const filteredAnimals = animals.filter((animal) => {
    const anyAnimal = animal as any;

    // Normalize status: treat missing as "active", compare case-insensitively
    const rawStatus = (anyAnimal.status ?? "active") as AnimalStatus | string;
    const normalizedStatus = rawStatus.toString().trim().toLowerCase();

    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
        ? // for "active", treat missing/empty as active as well
          normalizedStatus === "active" ||
          normalizedStatus === "" ||
          normalizedStatus == null
        : normalizedStatus === statusFilter;

    // Search by tag or name
    const matchesSearch =
      !searchLower ||
      animal.tagNumber.toLowerCase().includes(searchLower) ||
      (animal.phenotype ?? "").toLowerCase().includes(searchLower);

    // Type filter (dairy / beef / all)
    const matchesType = typeFilter === "all" || animal.type === typeFilter;

    // Sex filter
    const normalizedSex = (() => {
      if (animal.sex === "male") return "bull";
      if (animal.sex === "female") return "cow";
      return animal.sex;
    })();
    const matchesSex = sexFilter === "all" || normalizedSex === sexFilter;

    // CSN2 status filter
    const rawBetacasein = (anyAnimal.betacasein ?? "") as string;
    const betacaseinStatus = rawBetacasein || "Not Tested";
    const matchesBetacasein =
      betacaseinFilter === "all" || betacaseinStatus === betacaseinFilter;

    // Polled filter
    const matchesPolled =
      polledFilter === "all" ||
      (polledFilter === "yes" ? animal.polled === true : animal.polled === false);

    // Field filter: if any selected, require match
    const matchesField =
      selectedFieldIds.size === 0 ||
      (animal.currentFieldId && selectedFieldIds.has(animal.currentFieldId));

    return (
      matchesStatus &&
      matchesSearch &&
      matchesType &&
      matchesSex &&
      matchesBetacasein &&
      matchesPolled &&
      matchesField
    );
  });

  const displayAnimals = filteredAnimals.map((animal) => {
    const anyAnimal = animal as any;
    return {
      ...animal,
      currentLocation: anyAnimal.currentFieldName ?? anyAnimal.currentLocation ?? "-",
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Animals
          </h1>
          <p className="text-muted-foreground">Manage your herd registry</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-add-animal">
          <Plus className="h-4 w-4 mr-2" />
          Add Animal
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by tag number or phenotype..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search"
          />
        </div>

        {/* Location filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-[180px]" data-testid="dropdown-fields">
              {selectedFieldIds.size === 0
                ? "All locations"
                : `${selectedFieldIds.size} location${selectedFieldIds.size > 1 ? "s" : ""} selected`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Locations</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={selectedFieldIds.size === 0}
              onCheckedChange={() => setSelectedFieldIds(new Set())}
              data-testid="checkbox-field-all"
            >
              All locations
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {fields.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No fields available</div>
            ) : (
              fields.map((field) => (
                <DropdownMenuCheckboxItem
                  key={field.id}
                  checked={selectedFieldIds.has(field.id)}
                  onCheckedChange={(val) => {
                    setSelectedFieldIds((prev) => {
                      const next = new Set(prev);
                      if (val === true) {
                        next.add(field.id);
                      } else {
                        next.delete(field.id);
                      }
                      return next;
                    });
                  }}
                  data-testid={`checkbox-field-${field.id}`}
                >
                  {field.name}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Type filter */}
        <Select
          value={typeFilter}
          onValueChange={(val: "all" | "dairy" | "beef") => setTypeFilter(val)}
        >
          <SelectTrigger className="w-full sm:w-40" data-testid="select-filter-type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="dairy">Dairy</SelectItem>
            <SelectItem value="beef">Beef</SelectItem>
          </SelectContent>
        </Select>

        {/* Sex filter */}
        <Select
          value={sexFilter}
          onValueChange={(val) => setSexFilter(val as typeof sexFilter)}
        >
          <SelectTrigger className="w-full sm:w-36" data-testid="select-filter-sex">
            <SelectValue placeholder="Sex" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sexes</SelectItem>
            <SelectItem value="cow">Cow</SelectItem>
            <SelectItem value="bull">Bull</SelectItem>
            <SelectItem value="steer">Steer</SelectItem>
            <SelectItem value="stag">Stag</SelectItem>
            <SelectItem value="freemartin">Freemartin</SelectItem>
          </SelectContent>
        </Select>

        {/* Betacasein filter */}
        <Select
          value={betacaseinFilter}
          onValueChange={(val) => setBetacaseinFilter(val as BetacaseinFilter)}
        >
          <SelectTrigger className="w-full sm:w-40" data-testid="select-filter-betacasein">
            <SelectValue placeholder="A2 Genotype" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All A2 Genotype</SelectItem>
            <SelectItem value="A2/A2">A2/A2</SelectItem>
            <SelectItem value="A1">A1</SelectItem>
            <SelectItem value="Not Tested">Not Tested</SelectItem>
          </SelectContent>
        </Select>

        {/* Polled filter */}
        <Select
          value={polledFilter}
          onValueChange={(val: BooleanFilter) => setPolledFilter(val)}
        >
          <SelectTrigger className="w-full sm:w-32" data-testid="select-filter-polled">
            <SelectValue placeholder="Horn Genotype" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Horn Genotypes</SelectItem>
            <SelectItem value="yes">Polled</SelectItem>
            <SelectItem value="no">Horned</SelectItem>
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select
          value={statusFilter}
          onValueChange={(val) => setStatusFilter(val as StatusFilter)}
        >
          <SelectTrigger
            className="w-full sm:w-44"
            data-testid="select-filter-status"
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {animalStatusEnum.map((status) => (
              <SelectItem key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-[180px]" data-testid="dropdown-fields">
              {selectedFieldIds.size === 0
                ? "All locations"
                : `${selectedFieldIds.size} location${selectedFieldIds.size > 1 ? "s" : ""} selected`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Locations</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={selectedFieldIds.size === 0}
              onCheckedChange={() => setSelectedFieldIds(new Set())}
              data-testid="checkbox-field-all"
            >
              All locations
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {fields.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No fields available</div>
            ) : (
              fields.map((field) => (
                <DropdownMenuCheckboxItem
                  key={field.id}
                  checked={selectedFieldIds.has(field.id)}
                  onCheckedChange={(val) => {
                    setSelectedFieldIds((prev) => {
                      const next = new Set(prev);
                      if (val === true) {
                        next.add(field.id);
                      } else {
                        next.delete(field.id);
                      }
                      return next;
                    });
                  }}
                  data-testid={`checkbox-field-${field.id}`}
                >
                  {field.name}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading animals...</p>
        </div>
      ) : (
        <AnimalTable
          animals={displayAnimals as Animal[]}
          onView={handleViewAnimal}
          onEdit={handleEditAnimal}
          onDelete={handleDeleteAnimal}
        />
      )}

      <AnimalFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        animal={editingAnimal || undefined}
      />

      {selectedAnimal && (
        <AnimalDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          animal={selectedAnimal}
          onEdit={() => handleEditAnimal(selectedAnimal.id)}
        />
      )}
    </div>
  );
}
