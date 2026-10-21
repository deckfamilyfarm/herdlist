import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Syringe, Baby, Activity, Edit } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { VaccinationFormDialog } from "./VaccinationFormDialog";
import type { Vaccination, Event, CalvingRecord, Animal, AnimalStatus, Note, BreedingRecord, Owner, Movement, SlaughterRecord, Field } from "@shared/schema";
import { buildAnimalHistory } from "@/lib/animalHistory";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { animalStatusLabels } from "@/lib/animalStatus";
import { Trash2, Pencil } from "lucide-react";

interface AnimalDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animal: Animal;
  onEdit?: () => void;
}

const statusVariant: Partial<
  Record<AnimalStatus, "default" | "secondary" | "destructive" | "outline">
> = {
  active: "default",
  slaughtered: "secondary",
  sold: "secondary",
  expired: "secondary",
};

export function AnimalDetailDialog({ open, onOpenChange, animal, onEdit }: AnimalDetailDialogProps) {
  const [vaccinationDialogOpen, setVaccinationDialogOpen] = useState(false);
  const [noteForm, setNoteForm] = useState<{ noteDate: string; note: string }>(() => ({
    noteDate: new Date().toISOString().split("T")[0],
    note: "",
  }));
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [breedingForm, setBreedingForm] = useState<{
    method: BreedingRecord["method"] | "placeholder";
    breedingDate: string;
    exposureStartDate: string;
    exposureEndDate: string;
    sireId: string;
    notes: string;
  }>(() => ({
    method: "placeholder",
    breedingDate: new Date().toISOString().split("T")[0],
    exposureStartDate: "",
    exposureEndDate: "",
    sireId: "",
    notes: "",
  }));
  const [editingBreedingId, setEditingBreedingId] = useState<string | null>(null);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventForm, setEventForm] = useState({
    eventType: "", eventDate: new Date().toISOString().slice(0, 10), description: "",
  });
  const enrichedAnimal = animal as Animal & { 
    currentFieldName?: string | null; 
    sireTagNumber?: string | null; 
    damTagNumber?: string | null; 
    dueDate?: string | null;
    dueDateStatus?: string | null;
    dueDateBreedingRecordId?: string | null;
  };

  const formatDate = (value: Animal["dateOfBirth"]) => {
    if (!value) return "Not recorded";
    const str = value instanceof Date ? value.toISOString() : String(value);
    return str.includes("T") ? str.split("T")[0] : str;
  };

  const normalizeTags = (raw: any): string[] => {
    if (Array.isArray(raw)) return raw.map((t) => `${t}`.toLowerCase().trim()).filter(Boolean);
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((t) => `${t}`.toLowerCase().trim()).filter(Boolean);
        }
      } catch {
        /* ignore */
      }
      return raw
        .split(/[,;]/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
    }
    return [];
  };

  const formatPolledStatus = (value: any) => {
    const normalized = (() => {
      if (value === "polled" || value === "horned" || value === "not tested") return value;
      if (value === true) return "polled";
      if (value === false) return "not tested";
      const normalizedVal = typeof value === "string" ? value.trim().toLowerCase() : "";
      if (normalizedVal === "polled") return "polled";
      if (normalizedVal === "horned") return "horned";
      if (normalizedVal === "not tested" || normalizedVal === "not_tested" || normalizedVal === "nottested") {
        return "not tested";
      }
      return "not tested";
    })();

    return normalized === "not tested"
      ? "Not Tested"
      : normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const { data: vaccinations = [], isLoading: vaccinationsLoading, error: vaccinationsError } = useQuery<Vaccination[]>({
    queryKey: ['/api/vaccinations/animal', animal.id],
    enabled: open,
    staleTime: 0,
  });

  const { data: events = [], isLoading: eventsLoading, error: eventsError } = useQuery<Event[]>({
    queryKey: ['/api/events/animal', animal.id],
    enabled: open,
    staleTime: 0,
  });

  const { data: movements = [], isLoading: movementsLoading, error: movementsError } = useQuery<Movement[]>({
    queryKey: ['/api/movements/animal', animal.id], enabled: open, staleTime: 0,
  });
  const { data: fields = [], isLoading: fieldsLoading, error: fieldsError } = useQuery<Field[]>({ queryKey: ['/api/fields'], enabled: open, staleTime: 0 });
  const { data: slaughterRecords = [], isLoading: slaughterLoading, error: slaughterError } = useQuery<SlaughterRecord[]>({
    queryKey: ['/api/slaughter-records'], enabled: open, staleTime: 0,
  });
  const { data: ownershipHistory = [], isLoading: ownershipLoading, error: ownershipError } = useQuery<Array<{ id: string; ownerName: string; effectiveDate: string }>>({
    queryKey: [`/api/grazing-services/ownership/${animal.id}`], enabled: open, staleTime: 0,
  });

  const { data: calvingRecords = [], isLoading: calvingLoading, error: calvingError } = useQuery<CalvingRecord[]>({
    queryKey: ['/api/calving-records/dam', animal.id],
    enabled: open,
    staleTime: 0,
  });

  const { data: notes = [], isLoading: notesLoading, error: notesError } = useQuery<Note[]>({
    queryKey: ['/api/notes/animal', animal.id],
    enabled: open,
    staleTime: 0,
  });

  // Pull all animals (for sire lookup in breeding list)
  const { data: allAnimals = [] } = useQuery<Animal[]>({
    queryKey: ['/api/animals'],
    staleTime: 0,
  });
  const { data: owners = [] } = useQuery<Owner[]>({ queryKey: ['/api/grazing-services/owners'], enabled: open });

  const { data: breeding = [], isLoading: breedingLoading, error: breedingError } = useQuery<BreedingRecord[]>({
    queryKey: ['/api/breeding/animal', animal.id],
    enabled: open,
    staleTime: 0,
  });

  const addEventMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/events", {
        animalId: animal.id, eventType: eventForm.eventType.trim(), eventDate: eventForm.eventDate,
        description: eventForm.description.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events/animal', animal.id] });
      setEventFormOpen(false);
      setEventForm({ eventType: "", eventDate: new Date().toISOString().slice(0, 10), description: "" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (data: { id?: string; noteDate: string; note: string }) => {
      if (data.id) {
        const res = await apiRequest("PUT", `/api/notes/${data.id}`, {
          noteDate: data.noteDate,
          note: data.note,
        });
        return res.json();
      }
      const res = await apiRequest("POST", "/api/notes", {
        animalId: animal.id,
        noteDate: data.noteDate,
        note: data.note,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes/animal', animal.id] });
      setNoteForm({ noteDate: new Date().toISOString().split("T")[0], note: "" });
      setEditingNoteId(null);
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes/animal', animal.id] });
    },
  });

  const breedingMutation = useMutation({
    mutationFn: async (payload: Partial<BreedingRecord> & { animalId: string }) => {
      if (payload.id) {
        const res = await apiRequest("PUT", `/api/breeding/${payload.id}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/breeding", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/breeding/animal', animal.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/animals'] });
      setBreedingForm({
        method: "observed_live_cover",
        breedingDate: new Date().toISOString().split("T")[0],
        exposureStartDate: "",
        exposureEndDate: "",
        sireId: "",
        notes: "",
      });
      setEditingBreedingId(null);
    },
  });

  const deleteBreedingMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/breeding/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/breeding/animal', animal.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/animals'] });
    },
  });

  const { data: offspring = [], isLoading: offspringLoading } = useQuery<Animal[]>({
    queryKey: ['/api/animals', animal.id, 'offspring'],
    enabled: open,
  });

  const age = animal.dateOfBirth ? 
    `${Math.floor((new Date().getTime() - new Date(animal.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years` : 
    'Unknown';
  const normalizedTags = normalizeTags((animal as any).tags);
  const dueDateText = enrichedAnimal.dueDate
    ? enrichedAnimal.dueDate.includes("T")
      ? enrichedAnimal.dueDate.split("T")[0]
      : enrichedAnimal.dueDate
    : null;
  const history = useMemo(() => buildAnimalHistory({ animalId: animal.id, animal, events, movements, notes,
    breeding, vaccinations, calvingRecords, slaughterRecords, ownershipHistory, fields, allAnimals }),
  [animal, events, movements, notes, breeding, vaccinations, calvingRecords,
    slaughterRecords, ownershipHistory, fields, allAnimals]);
  const historyLoading = eventsLoading || movementsLoading || notesLoading || breedingLoading ||
    vaccinationsLoading || calvingLoading || fieldsLoading || slaughterLoading || ownershipLoading;
  const historyError = [eventsError, movementsError, notesError, breedingError, vaccinationsError,
    calvingError, fieldsError, slaughterError, ownershipError].find(Boolean);
  const formatTypeLabel = (type: string) => {
    const normalizedType = type.trim().toLowerCase();
    return normalizedType === "ai" ? "AI" : type;
  };
  const getTypeColor = (type: string) => {
    const normalizedType = type.trim().toLowerCase();
    if (normalizedType === "dairy") return "bg-chart-1";
    if (normalizedType === "beef") return "bg-chart-3";
    if (normalizedType === "ai") return "bg-chart-4";
    return "bg-muted";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-animal-detail">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-3">
                {animal.phenotype || animal.tagNumber}
                <Badge className={getTypeColor(animal.type)}>
                  {formatTypeLabel(animal.type)}
                </Badge>
                {/* ✅ Status badge */}
                <Badge variant={statusVariant[animal.status as AnimalStatus] ?? "outline"}>
                  {animalStatusLabels[animal.status as AnimalStatus] ?? "Active"}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-sm mt-1">
                Tag: <span className="font-readable-mono">{animal.tagNumber}</span> • {age} • {animal.sex}
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-edit-animal"
              onClick={() => {
                onEdit?.();
                onOpenChange(false);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="breeding" data-testid="tab-breeding">Breeding</TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger>
            <TabsTrigger value="vaccinations" data-testid="tab-vaccinations">Vaccinations</TabsTrigger>
            <TabsTrigger value="offspring" data-testid="tab-offspring">Offspring</TabsTrigger>
            <TabsTrigger value="events" data-testid="tab-events">Events</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date of Birth</span>
                    <span className="font-medium">{formatDate(animal.dateOfBirth)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Due Date</span>
                    <div className="flex items-center justify-end gap-2">
                      <span
                        className={
                          enrichedAnimal.dueDateStatus === "overdue-struck"
                            ? "font-medium line-through text-muted-foreground"
                            : "font-medium"
                        }
                      >
                        {dueDateText || "Not due"}
                      </span>
                      {enrichedAnimal.dueDateBreedingRecordId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (
                              confirm(
                                "Clear this due date? This removes the breeding record that created it.",
                              )
                            ) {
                              deleteBreedingMutation.mutate(enrichedAnimal.dueDateBreedingRecordId!);
                            }
                          }}
                          disabled={deleteBreedingMutation.isPending}
                          data-testid="button-clear-due-date"
                        >
                          Clear
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Location</span>
                    <span className="font-medium">{enrichedAnimal.currentFieldName || 'Not assigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Owner</span>
                    <span className="font-medium">{owners.find((owner) => owner.id === animal.ownerId)?.name || 'Not assigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Organic</span>
                    <span className="font-medium">{animal.organic ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">A2 Genotype</span>
                    <span className="font-medium">{(animal as any).betacasein || 'Not Tested'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Horn Status</span>
                    <span className="font-medium">{formatPolledStatus(animal.polled)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Tags</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {normalizedTags.length === 0 ? (
                        <span className="font-medium">—</span>
                      ) : (
                        normalizedTags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="capitalize">
                            {tag}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  {/* ✅ Status row */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium">
                      {animalStatusLabels[animal.status as AnimalStatus] ?? "Active"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Parentage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sire (Father)</span>
                    <span className="font-readable-mono font-medium">{enrichedAnimal.sireTagNumber || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dam (Mother)</span>
                    <span className="font-readable-mono font-medium">{enrichedAnimal.damTagNumber || 'Unknown'}</span>
                  </div>
                  <div className="pt-2">
                    <span className="text-muted-foreground block">Phenotype</span>
                    <span className="font-medium block mt-1">{animal.phenotype || 'Not recorded'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="breeding" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Breeding
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Method</label>
                    <Select
                      value={breedingForm.method}
                      onValueChange={(value) =>
                        setBreedingForm((prev) => ({
                          ...prev,
                          method: value as BreedingRecord["method"] | "placeholder",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full" data-testid="select-breeding-method">
                        <SelectValue placeholder="Select method" className="text-muted-foreground" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="placeholder" disabled>
                          Choose Breeding Method
                        </SelectItem>
                        <SelectItem value="observed_live_cover">Live cover</SelectItem>
                        <SelectItem value="extended_exposure">Extended exposure</SelectItem>
                        <SelectItem value="ai">AI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">
                      {breedingForm.method === "extended_exposure" ? "Exposure start" : "Breeding date"}
                    </label>
                    <Input
                      type="date"
                      value={
                        breedingForm.method === "extended_exposure"
                          ? breedingForm.exposureStartDate
                          : breedingForm.breedingDate
                      }
                      onChange={(e) =>
                        setBreedingForm((prev) =>
                          breedingForm.method === "extended_exposure"
                            ? { ...prev, exposureStartDate: e.target.value }
                            : { ...prev, breedingDate: e.target.value },
                        )
                      }
                      data-testid="input-breeding-date"
                    />
                  </div>

                  {breedingForm.method === "extended_exposure" && (
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Exposure end</label>
                      <Input
                        type="date"
                        value={breedingForm.exposureEndDate}
                        onChange={(e) =>
                          setBreedingForm((prev) => ({ ...prev, exposureEndDate: e.target.value }))
                        }
                        data-testid="input-exposure-end"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Sire (optional)</label>
                    {breedingForm.method === "ai" && (
                      <p className="text-xs text-muted-foreground">
                        Semen should be added as a bull with location set to Cold Storage.
                      </p>
                    )}
                    <Select
                      value={breedingForm.sireId || ""}
                      onValueChange={(value) => setBreedingForm((prev) => ({ ...prev, sireId: value }))}
                    >
                      <SelectTrigger className="w-full" data-testid="select-breeding-sire">
                        <SelectValue placeholder="Select sire (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {allAnimals
                          .filter((a) => a.sex === "bull" || a.sex === "male")
                          .slice()
                          .sort((a, b) => a.tagNumber.localeCompare(b.tagNumber))
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.tagNumber} {a.phenotype ? `(${a.phenotype})` : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Notes</label>
                  <Textarea
                    rows={3}
                    placeholder="Add breeding notes..."
                    value={breedingForm.notes}
                    onChange={(e) => setBreedingForm((prev) => ({ ...prev, notes: e.target.value }))}
                    data-testid="textarea-breeding-notes"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  {editingBreedingId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingBreedingId(null);
                        setBreedingForm({
                          method: "placeholder",
                          breedingDate: new Date().toISOString().split("T")[0],
                          exposureStartDate: "",
                          exposureEndDate: "",
                          sireId: "",
                          notes: "",
                        });
                      }}
                      data-testid="button-cancel-breeding"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() =>
                      breedingMutation.mutate({
                        id: editingBreedingId ?? undefined,
                        animalId: animal.id,
                        method: breedingForm.method as BreedingRecord["method"],
                        breedingDate:
                          breedingForm.method === "extended_exposure" ? null : breedingForm.breedingDate,
                        exposureStartDate:
                          breedingForm.method === "extended_exposure" ? breedingForm.exposureStartDate : null,
                        exposureEndDate:
                          breedingForm.method === "extended_exposure" ? breedingForm.exposureEndDate : null,
                        notes: breedingForm.notes || null,
                        sireId: breedingForm.sireId || null,
                      })
                    }
                    disabled={breedingForm.method === "placeholder"}
                    data-testid="button-save-breeding"
                  >
                    {editingBreedingId ? "Update Breeding" : "Add Breeding"}
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Method</TableHead>
                      <TableHead>Date(s)</TableHead>
                      <TableHead>Sire</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breedingLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : breeding.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No breeding records
                        </TableCell>
                      </TableRow>
                    ) : (
                      breeding.map((record) => {
                        const methodLabel =
                          record.method === "observed_live_cover"
                            ? "Observed live cover"
                            : record.method === "extended_exposure"
                            ? "Extended exposure"
                            : "AI";
                        const sire = allAnimals.find((a) => a.id === record.sireId);
                        const dateDisplay =
                          record.method === "extended_exposure"
                            ? `${record.exposureStartDate?.split("T")[0] ?? "-"} — ${record.exposureEndDate?.split("T")[0] ?? "-"}`
                            : (record.breedingDate ? record.breedingDate.split("T")[0] : "-");
                        return (
                          <TableRow key={record.id}>
                            <TableCell>{methodLabel}</TableCell>
                            <TableCell className="font-mono">{dateDisplay}</TableCell>
                            <TableCell className="font-mono">
                              {sire ? sire.tagNumber : record.sireId ? record.sireId : "—"}
                            </TableCell>
                            <TableCell className="whitespace-pre-wrap">{record.notes || "—"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingBreedingId(record.id);
                                    setBreedingForm({
                                      method: record.method,
                                      breedingDate: record.breedingDate ?? "",
                                      exposureStartDate: record.exposureStartDate ?? "",
                                      exposureEndDate: record.exposureEndDate ?? "",
                                      sireId: record.sireId ?? "",
                                      notes: record.notes ?? "",
                                    });
                                  }}
                                  data-testid={`button-edit-breeding-${record.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteBreedingMutation.mutate(record.id)}
                                  data-testid={`button-delete-breeding-${record.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="notes" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground" htmlFor="noteDate">Date</label>
                    <Input
                      id="noteDate"
                      type="date"
                      value={noteForm.noteDate}
                      onChange={(e) => setNoteForm((prev) => ({ ...prev, noteDate: e.target.value }))}
                      data-testid="input-note-date"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-sm text-muted-foreground" htmlFor="noteText">Note</label>
                    <Textarea
                      id="noteText"
                      rows={3}
                      placeholder="Add note about this animal..."
                      value={noteForm.note}
                      onChange={(e) => setNoteForm((prev) => ({ ...prev, note: e.target.value }))}
                      data-testid="textarea-note"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="flex gap-2">
                    {editingNoteId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingNoteId(null);
                          setNoteForm({ noteDate: new Date().toISOString().split("T")[0], note: "" });
                        }}
                        data-testid="button-cancel-edit-note"
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => addNoteMutation.mutate({ ...noteForm, id: editingNoteId ?? undefined })}
                      disabled={!noteForm.note.trim()}
                      data-testid="button-add-note"
                    >
                      {editingNoteId ? "Update Note" : "Add Note"}
                    </Button>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notesLoading ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : notes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          No notes yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      [...notes].map((note) => (
                        <TableRow key={note.id}>
                          <TableCell className="font-mono font-medium">{formatNoteDate(note.noteDate)}</TableCell>
                          <TableCell className="whitespace-pre-wrap">
                            <div className="flex items-start justify-between gap-2">
                              <span>{note.note}</span>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingNoteId(note.id);
                                    setNoteForm({
                                      noteDate: note.noteDate,
                                      note: note.note,
                                    });
                                  }}
                                  data-testid={`button-edit-note-${note.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteNoteMutation.mutate(note.id)}
                                  data-testid={`button-delete-note-${note.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vaccinations" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Syringe className="h-4 w-4" />
                  Vaccination Records
                </CardTitle>
                <Button size="sm" data-testid="button-add-vaccination" onClick={() => setVaccinationDialogOpen(true)}>
                  Add Vaccination
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Vaccine</TableHead>
                      <TableHead>Administered By</TableHead>
                      <TableHead>Next Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vaccinationsLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center">Loading...</TableCell>
                      </TableRow>
                    ) : vaccinations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">No vaccinations recorded</TableCell>
                      </TableRow>
                    ) : (
                      vaccinations.map((vac) => (
                        <TableRow key={vac.id}>
                          <TableCell className="font-medium">{vac.administeredDate}</TableCell>
                          <TableCell>{vac.vaccineName}</TableCell>
                          <TableCell>{vac.administeredBy || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{vac.nextDueDate || 'Not set'}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="offspring" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Baby className="h-4 w-4" />
                  Offspring
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tag Number</TableHead>
                      <TableHead>Phenotype</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Sex</TableHead>
                      <TableHead>Date of Birth</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {offspringLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                      </TableRow>
                    ) : offspring.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">No offspring found</TableCell>
                      </TableRow>
                    ) : (
                      offspring.map((child) => {
                        const enrichedChild = child as Animal & { currentFieldName?: string | null };
                        return (
                            <TableRow key={child.id} data-testid={`row-offspring-${child.id}`}>
                            <TableCell className="font-readable-mono font-medium">{child.tagNumber}</TableCell>
                              <TableCell>{child.phenotype || '-'}</TableCell>
                              <TableCell>
                                <Badge className={getTypeColor(child.type)}>
                                  {formatTypeLabel(child.type)}
                                </Badge>
                            </TableCell>
                            <TableCell className="capitalize">{child.sex}</TableCell>
                            <TableCell>{formatDate(child.dateOfBirth)}</TableCell>
                            <TableCell>{enrichedChild.currentFieldName || 'Not assigned'}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Event History
                </CardTitle>
                <Button size="sm" data-testid="button-add-event" onClick={() => setEventFormOpen((value) => !value)}>
                  Add Event
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {eventFormOpen && <div className="space-y-3 rounded-md border p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1"><label className="text-sm font-medium" htmlFor="event-type">Event type</label>
                      <Input id="event-type" maxLength={100} value={eventForm.eventType}
                        onChange={(event) => setEventForm({ ...eventForm, eventType: event.target.value })}
                        placeholder="Example: Health check" /></div>
                    <div className="space-y-1"><label className="text-sm font-medium" htmlFor="event-date">Date</label>
                      <Input id="event-date" type="date" value={eventForm.eventDate}
                        onChange={(event) => setEventForm({ ...eventForm, eventDate: event.target.value })} /></div>
                  </div>
                  <div className="space-y-1"><label className="text-sm font-medium" htmlFor="event-description">Description</label>
                    <Textarea id="event-description" maxLength={1000} value={eventForm.description}
                      onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} /></div>
                  {addEventMutation.error && <p role="alert" className="text-sm text-destructive">Could not save event: {String(addEventMutation.error)}</p>}
                  <div className="flex gap-2"><Button size="sm" disabled={addEventMutation.isPending ||
                    !eventForm.eventType.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(eventForm.eventDate)}
                    onClick={() => addEventMutation.mutate()}>Save event</Button>
                    <Button size="sm" variant="outline" onClick={() => setEventFormOpen(false)}>Cancel</Button></div>
                </div>}
                <p className="text-xs text-muted-foreground">Movement, notes, breeding, ownership, health, and exit records appear here alongside manually added events.</p>
                {historyError ? (
                  <p role="alert" className="text-sm text-destructive">Some event history could not load: {String(historyError)}</p>
                ) : null}
                {historyLoading ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Loading event history...</p>
                ) : history.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No history recorded for this animal</p>
                ) : (
                  <div className="space-y-3">
                    {history.map((event) => (
                      <div
                        key={event.key}
                        className="flex gap-4 border-l-2 border-chart-1 pl-4 py-2"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{event.type}</Badge>
                            <span className="text-xs text-muted-foreground">{event.date}</span>
                          </div>
                          <p className="text-sm mt-1 whitespace-pre-wrap">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>

      <VaccinationFormDialog
        open={vaccinationDialogOpen}
        onOpenChange={setVaccinationDialogOpen}
        animalId={animal.id}
      />
    </Dialog>
  );
}
  const formatNoteDate = (value: string) => {
    if (!value) return "-";
    return value.includes("T") ? value.split("T")[0] : value;
  };
