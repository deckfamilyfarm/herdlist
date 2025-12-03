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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Syringe, Baby, Activity, Edit } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { VaccinationFormDialog } from "./VaccinationFormDialog";
import type { Vaccination, Event, CalvingRecord, Animal, AnimalStatus } from "@shared/schema";

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
  const enrichedAnimal = animal as Animal & { 
    currentFieldName?: string | null; 
    sireTagNumber?: string | null; 
    damTagNumber?: string | null; 
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
                {animal.name || animal.tagNumber}
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
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
                    <span className="font-medium">{animal.dateOfBirth || 'Not recorded'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Location</span>
                    <span className="font-medium">{enrichedAnimal.currentFieldName || 'Not assigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Breeding Method</span>
                    <span className="font-medium capitalize">
                      {animal.breedingMethod?.replace('-', ' ') || 'Not recorded'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Herd Name</span>
                    <span className="font-medium capitalize">{animal.herdName || 'Not assigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Organic</span>
                    <span className="font-medium">{animal.organic ? 'Yes' : 'No'}</span>
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
                </CardContent>
              </Card>
            </div>
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
                      <TableHead>Name</TableHead>
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
                            <TableCell>{child.name || '-'}</TableCell>
                            <TableCell>
                              <Badge className={child.type === 'dairy' ? 'bg-chart-1' : 'bg-chart-3'}>
                                {child.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="capitalize">{child.sex}</TableCell>
                            <TableCell>{child.dateOfBirth || 'Not recorded'}</TableCell>
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

