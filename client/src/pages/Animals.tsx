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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  animalStatusEnum,
  polledStatusEnum,
  animalTagOptions,
  type Animal,
  type AnimalStatus,
  type Field,
  type Property,
  type PolledStatus,
} from "@shared/schema";

type StatusFilter = "all" | AnimalStatus;
type PolledFilter = "all" | PolledStatus;
type BetacaseinFilter = "all" | "A2/A2" | "A1" | "Not Tested";
const NO_LOCATION_ID = "__NO_LOCATION__";

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

export default function Animals() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMoveFieldId, setBulkMoveFieldId] = useState<string>("");
  const [bulkMoveDate, setBulkMoveDate] = useState<string>(() =>
    new Date().toISOString().split("T")[0],
  );
  const [bulkMoveNote, setBulkMoveNote] = useState<string>("");
  const [bulkTags, setBulkTags] = useState<Set<string>>(new Set());
  const [bulkRemoveTags, setBulkRemoveTags] = useState<Set<string>>(new Set());

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "dairy" | "beef">("all");
  const [sexFilter, setSexFilter] = useState<"all" | "cow" | "bull" | "steer" | "stag" | "freemartin">("all");
  const [polledFilter, setPolledFilter] = useState<PolledFilter>("all");
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all"); // default "all"
  const [betacaseinFilter, setBetacaseinFilter] = useState<BetacaseinFilter>("all");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const { data: animals = [], isLoading } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
  });

  const { data: fields = [] } = useQuery<Field[]>({
    queryKey: ['/api/fields'],
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
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

  const bulkMoveMutation = useMutation({
    mutationFn: async ({
      animalIds,
      fieldId,
      movementDate,
      note,
    }: {
      animalIds: string[];
      fieldId: string;
      movementDate: string;
      note?: string;
    }) => {
      await apiRequest("POST", "/api/animals/bulk-move", { animalIds, fieldId, movementDate, note });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/animals"] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/property-counts'] });
      toast({
        title: "Move complete",
        description: `Moved ${variables.animalIds.length} animals to new field.`,
      });
      setSelectedIds(new Set());
      setBulkMoveFieldId("");
      setBulkMoveDate(new Date().toISOString().split("T")[0]);
      setBulkMoveNote("");
    },
    onError: (error: Error) => {
      toast({
        title: "Move failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkTagsMutation = useMutation({
    mutationFn: async ({ animalIds, tags }: { animalIds: string[]; tags: string[] }) => {
      await apiRequest("POST", "/api/animals/bulk-tags", { animalIds, tags });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/animals"] });
      toast({
        title: "Tags applied",
        description: `Applied tags to ${variables.animalIds.length} animals.`,
      });
      setBulkTags(new Set());
      setSelectedIds(new Set());
    },
    onError: (error: Error) => {
      toast({
        title: "Tag update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkRemoveTagsMutation = useMutation({
    mutationFn: async ({ animalIds, tags }: { animalIds: string[]; tags: string[] }) => {
      await apiRequest("POST", "/api/animals/bulk-tags/remove", { animalIds, tags });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/animals"] });
      toast({
        title: "Tags removed",
        description: `Removed tags from ${variables.animalIds.length} animals.`,
      });
      setBulkRemoveTags(new Set());
      setSelectedIds(new Set());
    },
    onError: (error: Error) => {
      toast({
        title: "Tag removal failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
    const polledStatus = normalizePolledStatus(anyAnimal.polled);
    const matchesPolled = polledFilter === "all" || polledStatus === polledFilter;

    // Tags filter: require intersection if any selected
    const animalTags: string[] = Array.isArray((anyAnimal as any).tags) ? (anyAnimal as any).tags : [];
    const matchesTags =
      selectedTags.size === 0 ||
      animalTags.some((tag) => selectedTags.has(tag));

    // Field filter: if any selected, require match
    const matchesField =
      selectedFieldIds.size === 0 ||
      (animal.currentFieldId && selectedFieldIds.has(animal.currentFieldId)) ||
      (!animal.currentFieldId && selectedFieldIds.has(NO_LOCATION_ID));

    return (
      matchesStatus &&
      matchesSearch &&
      matchesType &&
      matchesSex &&
      matchesBetacasein &&
      matchesPolled &&
      matchesTags &&
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

  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(displayAnimals.map((a) => a.id));
      return new Set([...prev].filter((id) => validIds.has(id)));
    });
  }, [displayAnimals]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(displayAnimals.map((a) => a.id)));
  };

  const deselectAll = () => setSelectedIds(new Set());

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
                ? "All fields"
                : `${selectedFieldIds.size} field${selectedFieldIds.size > 1 ? "s" : ""} selected`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Fields</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setSelectedFieldIds(new Set());
              }}
              data-testid="checkbox-field-all"
              className="flex items-center gap-2"
            >
              <Checkbox checked={selectedFieldIds.size === 0} className="pointer-events-none" />
              All fields
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setSelectedFieldIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(NO_LOCATION_ID)) {
                    next.delete(NO_LOCATION_ID);
                  } else {
                    next.add(NO_LOCATION_ID);
                  }
                  return next;
                });
              }}
              data-testid="checkbox-field-none"
              className="flex items-center gap-2"
            >
              <Checkbox checked={selectedFieldIds.has(NO_LOCATION_ID)} className="pointer-events-none" />
              No location
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {fields.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No fields available</div>
            ) : (
              (() => {
                const propertyNameById = new Map<string, string>();
                properties.forEach((p) => propertyNameById.set(p.id, p.name));

                const fieldsByProperty = new Map<string, Field[]>();
                fields.forEach((field) => {
                  const propId = field.propertyId || "unknown";
                  const arr = fieldsByProperty.get(propId) ?? [];
                  arr.push(field);
                  fieldsByProperty.set(propId, arr);
                });

                const sortedPropertyIds = Array.from(fieldsByProperty.keys()).sort((a, b) => {
                  const nameA = propertyNameById.get(a) ?? "Unknown property";
                  const nameB = propertyNameById.get(b) ?? "Unknown property";
                  return nameA.localeCompare(nameB);
                });

                return sortedPropertyIds.map((propId) => {
                  const propName = propertyNameById.get(propId) ?? "Unknown property";
                  const sortedFields = (fieldsByProperty.get(propId) ?? []).sort((a, b) =>
                    a.name.localeCompare(b.name),
                  );
                  return (
                    <div key={propId}>
                      <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                        {propName}
                      </DropdownMenuLabel>
                      {sortedFields.map((field) => (
                        <DropdownMenuItem
                          key={field.id}
                          onSelect={(e) => {
                            e.preventDefault();
                            setSelectedFieldIds((prev) => {
                              const next = new Set(prev);
                              next.has(field.id) ? next.delete(field.id) : next.add(field.id);
                              return next;
                            });
                          }}
                          data-testid={`checkbox-field-${field.id}`}
                          className="flex items-center gap-2 pl-4"
                        >
                          <Checkbox checked={selectedFieldIds.has(field.id)} className="pointer-events-none" />
                          {field.name}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </div>
                  );
                });
              })()
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
          onValueChange={(val) => setPolledFilter(val as PolledFilter)}
        >
          <SelectTrigger className="w-full sm:w-40" data-testid="select-filter-polled">
            <SelectValue placeholder="Horn Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Horn Status</SelectItem>
            {polledStatusEnum.map((status) => (
              <SelectItem key={status} value={status}>
                {status === "not tested"
                  ? "Not Tested"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tags filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-[160px]" data-testid="dropdown-tags">
              {selectedTags.size === 0
                ? "All tags"
                : `${selectedTags.size} tag${selectedTags.size > 1 ? "s" : ""} selected`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 max-h-64 overflow-y-auto">
            <DropdownMenuLabel>Tags</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setSelectedTags(new Set());
              }}
              className="flex items-center gap-2"
            >
              <Checkbox checked={selectedTags.size === 0} className="pointer-events-none" />
              All tags
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {animalTagOptions.map((tag) => (
              <DropdownMenuItem
                key={tag}
                onSelect={(e) => {
                  e.preventDefault();
                  setSelectedTags((prev) => {
                    const next = new Set(prev);
                    next.has(tag) ? next.delete(tag) : next.add(tag);
                    return next;
                  });
                }}
                className="flex items-center gap-2"
                data-testid={`checkbox-filter-tag-${tag}`}
              >
                <Checkbox checked={selectedTags.has(tag)} className="pointer-events-none" />
                <span className="capitalize">{tag}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

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

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border rounded-md p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Button variant="outline" onClick={selectAllVisible} disabled={displayAnimals.length === 0} data-testid="button-select-all">
            Select all ({displayAnimals.length})
          </Button>
          <Button variant="outline" onClick={deselectAll} disabled={selectedIds.size === 0} data-testid="button-deselect-all">
            Deselect all
          </Button>
          <span className="text-sm text-muted-foreground">Selected: {selectedIds.size}</span>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={bulkMoveFieldId} onValueChange={(val) => setBulkMoveFieldId(val)}>
            <SelectTrigger className="w-48" data-testid="select-bulk-move-field">
              <SelectValue placeholder="Move to field" />
            </SelectTrigger>
            <SelectContent>
              {fields.length === 0 ? (
                <SelectItem value="none" disabled>
                  No fields available
                </SelectItem>
              ) : (
                (() => {
                  const propertyNameById = new Map<string, string>();
                  properties.forEach((p) => propertyNameById.set(p.id, p.name));

                  const fieldsByProperty = new Map<string, Field[]>();
                  fields.forEach((field) => {
                    const propId = field.propertyId || "unknown";
                    const arr = fieldsByProperty.get(propId) ?? [];
                    arr.push(field);
                    fieldsByProperty.set(propId, arr);
                  });

                  const sortedPropertyIds = Array.from(fieldsByProperty.keys()).sort((a, b) => {
                    const nameA = propertyNameById.get(a) ?? "Unknown property";
                    const nameB = propertyNameById.get(b) ?? "Unknown property";
                    return nameA.localeCompare(nameB);
                  });

                  return sortedPropertyIds.map((propId) => {
                    const propName = propertyNameById.get(propId) ?? "Unknown property";
                    const sortedFields = (fieldsByProperty.get(propId) ?? []).sort((a, b) =>
                      a.name.localeCompare(b.name),
                    );
                    return (
                      <div key={propId}>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{propName}</div>
                        {sortedFields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.name}
                          </SelectItem>
                        ))}
                        <DropdownMenuSeparator />
                      </div>
                    );
                  });
                })()
              )}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={bulkMoveDate}
            onChange={(e) => setBulkMoveDate(e.target.value)}
            className="w-40"
            max={new Date().toISOString().split("T")[0]}
            data-testid="input-bulk-move-date"
          />
          <Input
            placeholder="Optional note"
            value={bulkMoveNote}
            onChange={(e) => setBulkMoveNote(e.target.value)}
            className="w-48"
            data-testid="input-bulk-move-note"
          />
          <Button
            onClick={() =>
              bulkMoveMutation.mutate({
                animalIds: Array.from(selectedIds),
                fieldId: bulkMoveFieldId,
                movementDate: bulkMoveDate,
                note: bulkMoveNote.trim() || undefined,
              })
            }
            disabled={selectedIds.size === 0 || !bulkMoveFieldId || !bulkMoveDate || bulkMoveMutation.isPending}
            data-testid="button-bulk-move"
          >
            {bulkMoveMutation.isPending ? "Moving..." : "Move selected"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="min-w-[160px]" data-testid="dropdown-bulk-tags">
                {bulkTags.size === 0
                  ? "Select tags to add"
                  : `${bulkTags.size} tag${bulkTags.size > 1 ? "s" : ""} to add`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 max-h-64 overflow-y-auto">
              <DropdownMenuLabel>Add Tags</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setBulkTags(new Set());
                }}
                className="flex items-center gap-2"
              >
                <Checkbox checked={bulkTags.size === 0} className="pointer-events-none" />
                Clear selection
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {animalTagOptions.map((tag) => (
                <DropdownMenuItem
                  key={tag}
                  onSelect={(e) => {
                    e.preventDefault();
                    setBulkTags((prev) => {
                      const next = new Set(prev);
                      next.has(tag) ? next.delete(tag) : next.add(tag);
                      return next;
                    });
                  }}
                  className="flex items-center gap-2"
                  data-testid={`checkbox-bulk-tag-${tag}`}
                >
                  <Checkbox checked={bulkTags.has(tag)} className="pointer-events-none" />
                  <span className="capitalize">{tag}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() =>
              bulkTagsMutation.mutate({
                animalIds: Array.from(selectedIds),
                tags: Array.from(bulkTags),
              })
            }
            disabled={selectedIds.size === 0 || bulkTags.size === 0 || bulkTagsMutation.isPending}
            data-testid="button-bulk-apply-tags"
          >
            {bulkTagsMutation.isPending ? "Applying..." : "Apply tags"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="min-w-[160px]" data-testid="dropdown-bulk-remove-tags">
                {bulkRemoveTags.size === 0
                  ? "Select tags to remove"
                  : `${bulkRemoveTags.size} tag${bulkRemoveTags.size > 1 ? "s" : ""} to remove`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 max-h-64 overflow-y-auto">
              <DropdownMenuLabel>Remove Tags</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setBulkRemoveTags(new Set());
                }}
                className="flex items-center gap-2"
              >
                <Checkbox checked={bulkRemoveTags.size === 0} className="pointer-events-none" />
                Clear selection
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {animalTagOptions.map((tag) => (
                <DropdownMenuItem
                  key={tag}
                  onSelect={(e) => {
                    e.preventDefault();
                    setBulkRemoveTags((prev) => {
                      const next = new Set(prev);
                      next.has(tag) ? next.delete(tag) : next.add(tag);
                      return next;
                    });
                  }}
                  className="flex items-center gap-2"
                  data-testid={`checkbox-bulk-remove-tag-${tag}`}
                >
                  <Checkbox checked={bulkRemoveTags.has(tag)} className="pointer-events-none" />
                  <span className="capitalize">{tag}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() =>
              bulkRemoveTagsMutation.mutate({
                animalIds: Array.from(selectedIds),
                tags: Array.from(bulkRemoveTags),
              })
            }
            disabled={selectedIds.size === 0 || bulkRemoveTags.size === 0 || bulkRemoveTagsMutation.isPending}
            data-testid="button-bulk-remove-tags"
          >
            {bulkRemoveTagsMutation.isPending ? "Removing..." : "Remove tags"}
          </Button>
        </div>
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
          onSearchChange={setSearchTerm}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
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
