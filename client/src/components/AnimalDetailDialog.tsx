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
import { useState } from "react";
import { VaccinationFormDialog } from "./VaccinationFormDialog";
import type { Vaccination, Event, CalvingRecord, Animal, AnimalStatus, Note, BreedingRecord } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trash2, Pencil } from "lucide-react";

interface AnimalDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animal: Animal;
  onEdit?: () => void;
}

const statusLabel: Record<AnimalStatus, string> = {
  active: "Active",
  slaughtered: "Slaughtered",
  sold: "Sold",
  died: "Died",
  missing: "Missing",
};

const statusVariant: Partial<
  Record<AnimalStatus, "default" | "secondary" | "destructive" | "outline">
> = {
  active: "default",
  slaughtered: "secondary",
  sold: "secondary",
  died: "destructive",
  missing: "outline",
};

export function AnimalDetailDialog({ open, onOpenChange, animal, onEdit }: AnimalDetailDialogProps) {
  const [vaccinationDialogOpen, setVaccinationDialogOpen] = useState(false);
  const [noteForm, setNoteForm] = useState<{ noteDate: string; note: string }>(() => ({
    noteDate: new Date().toISOString().split("T")[0],
    note: "",
  }));
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [breedingForm, setBreedingForm] = useState<{
    method: BreedingRecord["method"];
    breedingDate: string;
    exposureStartDate: string;
    exposureEndDate: string;
    sireId: string;
    notes: string;
  }>(() => ({
    method: "observed_live_cover",
    breedingDate: new Date().toISOString().split("T")[0],
    exposureStartDate: "",
    exposureEndDate: "",
    sireId: "",
    notes: "",
  }));
  const [editingBreedingId, setEditingBreedingId] = useState<string | null>(null);
  const enrichedAnimal = animal as Animal & { 
    currentFieldName?: string | null; 
    sireTagNumber?: string | null; 
    damTagNumber?: string | null; 
  };

  const formatDate = (value: Animal["dateOfBirth"]) => {
    if (!value) return "Not recorded";
    const str = value instanceof Date ? value.toISOString() : String(value);
    return str.includes("T") ? str.split("T")[0] : str;
  };

  const { data: vaccinations = [], isLoading: vaccinationsLoading } = useQuery<Vaccination[]>({
    queryKey: ['/api/vaccinations/animal', animal.id],
    enabled: open,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ['/api/events/animal', animal.id],
    enabled: open,
  });

  const { data: calvingRecords = [], isLoading: calvingLoading } = useQuery<CalvingRecord[]>({
    queryKey: ['/api/calving-records/dam', animal.id],
    enabled: open && animal.sex === 'female',
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery<Note[]>({
    queryKey: ['/api/notes/animal', animal.id],
    enabled: open,
  });

  // Pull all animals (for sire lookup in breeding list)
  const { data: allAnimals = [] } = useQuery<Animal[]>({
    queryKey: ['/api/animals'],
  });

  const { data: breeding = [], isLoading: breedingLoading } = useQuery<BreedingRecord[]>({
    queryKey: ['/api/breeding/animal', animal.id],
    enabled: open,
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
    },
  });

  const { data: offspring = [], isLoading: offspringLoading } = useQuery<Animal[]>({
    queryKey: ['/api/animals', animal.id, 'offspring'],
    enabled: open,
  });

  const age = animal.dateOfBirth ? 
    `${Math.floor((new Date().getTime() - new Date(animal.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years` : 
    'Unknown';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-animal-detail">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-3">
                {animal.phenotype || animal.tagNumber}
                <Badge className={animal.type === 'dairy' ? 'bg-chart-1' : 'bg-chart-3'}>
                  {animal.type}
                </Badge>
                {/* ✅ Status badge */}
                <Badge variant={statusVariant[animal.status as AnimalStatus] ?? "outline"}>
                  {statusLabel[animal.status as AnimalStatus] ?? "Active"}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-sm mt-1">
                Tag: <span className="font-mono">{animal.tagNumber}</span> • {age} • {animal.sex}
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
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Location</span>
                    <span className="font-medium">{enrichedAnimal.currentFieldName || 'Not assigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Herd Name</span>
                    <span className="font-medium capitalize">{animal.herdName || 'Not assigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Organic</span>
                    <span className="font-medium">{animal.organic ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">A2A2</span>
                    <span className="font-medium">{animal.a2a2 ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Polled</span>
                    <span className="font-medium">{animal.polled ? 'Yes' : 'No'}</span>
                  </div>
                  {/* ✅ Status row */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium">
                      {statusLabel[animal.status as AnimalStatus] ?? "Active"}
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
                    <span className="font-mono font-medium">{enrichedAnimal.sireTagNumber || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dam (Mother)</span>
                    <span className="font-mono font-medium">{enrichedAnimal.damTagNumber || 'Unknown'}</span>
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
                          method: value as BreedingRecord["method"],
                        }))
                      }
                    >
                      <SelectTrigger className="w-full" data-testid="select-breeding-method">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="observed_live_cover">Observed live cover</SelectItem>
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
                          method: "observed_live_cover",
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
                        method: breedingForm.method,
                        breedingDate: breedingForm.method === "extended_exposure" ? null : breedingForm.breedingDate,
                        exposureStartDate:
                          breedingForm.method === "extended_exposure" ? breedingForm.exposureStartDate : null,
                        exposureEndDate:
                          breedingForm.method === "extended_exposure" ? breedingForm.exposureEndDate : null,
                        notes: breedingForm.notes || null,
                        sireId: breedingForm.sireId || null,
                      })
                    }
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
                              <TableCell className="font-mono font-medium">{child.tagNumber}</TableCell>
                              <TableCell>{child.phenotype || '-'}</TableCell>
                              <TableCell>
                                <Badge className={child.type === 'dairy' ? 'bg-chart-1' : 'bg-chart-3'}>
                                  {child.type}
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
                <Button size="sm" data-testid="button-add-event">
                  Add Event
                </Button>
              </CardHeader>
              <CardContent>
                {eventsLoading ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Loading events...</p>
                ) : events.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No events recorded</p>
                ) : (
                  <div className="space-y-3">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="flex gap-4 border-l-2 border-chart-1 pl-4 py-2"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{event.eventType}</Badge>
                            <span className="text-xs text-muted-foreground">{event.eventDate}</span>
                          </div>
                          <p className="text-sm mt-1">{event.description || 'No description'}</p>
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
