import { AnimalTable } from "@/components/AnimalTable";
import { AnimalFormDialog } from "@/components/AnimalFormDialog";
import { AnimalDetailDialog } from "@/components/AnimalDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Animal } from "@shared/schema";

type StatusFilter = "all" | "active" | "slaughtered" | "sold" | "died" | "missing";

export default function Animals() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "dairy" | "beef">("all");
  const [locationFilter, setLocationFilter] = useState<"all" | "home" | "lease">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active"); // default "active"

  const { data: animals = [], isLoading } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
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
    const rawStatus = (anyAnimal.status ?? "active") as string;
    const normalizedStatus = rawStatus.toString().trim().toLowerCase();

    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
        ? // for "active", treat missing/empty as active as well
          normalizedStatus === "active" || normalizedStatus === "" || normalizedStatus == null
        : normalizedStatus === statusFilter;

    // Search by tag or name
    const matchesSearch =
      !searchLower ||
      animal.tagNumber.toLowerCase().includes(searchLower) ||
      (animal.name ?? "").toLowerCase().includes(searchLower);

    // Type filter (dairy / beef / all)
    const matchesType =
      typeFilter === "all" || animal.type === typeFilter;

    // Location filter (home / lease / all)
    const fieldName = (anyAnimal.currentFieldName?.toLowerCase?.() ?? "") as string;
    let matchesLocation = true;
    if (locationFilter !== "all") {
      if (locationFilter === "home") {
        // treat anything not explicitly "lease" as home
        matchesLocation = !fieldName.includes("lease");
      } else if (locationFilter === "lease") {
        matchesLocation = fieldName.includes("lease");
      }
    }

    return matchesStatus && matchesSearch && matchesType && matchesLocation;
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
            placeholder="Search by tag number or name..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search"
          />
        </div>

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

        {/* Location filter */}
        <Select
          value={locationFilter}
          onValueChange={(val: "all" | "home" | "lease") => setLocationFilter(val)}
        >
          <SelectTrigger className="w-full sm:w-40" data-testid="select-filter-location">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            <SelectItem value="home">Home Farm</SelectItem>
            <SelectItem value="lease">Lease Properties</SelectItem>
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
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="slaughtered">Slaughtered</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="died">Died</SelectItem>
            <SelectItem value="missing">Missing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading animals...</p>
        </div>
      ) : (
        <AnimalTable
          animals={filteredAnimals as Animal[]}
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

