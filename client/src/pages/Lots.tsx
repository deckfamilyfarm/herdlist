import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Edit, History, MoveRight, Plus, Settings, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  Field,
  LivestockLotCountEvent,
  LivestockLotEventType,
  LivestockLotListItem,
  LivestockLotStatus,
  LivestockSpeciesSettings,
  LivestockTrackingMode,
  Property,
} from "@shared/schema";
import {
  livestockLotEventTypeEnum,
  livestockLotStatusEnum,
  livestockTrackingModeEnum,
} from "@shared/schema";

const NO_FIELD = "__NO_FIELD__";
const NEW_LOT = "__NEW_LOT__";

const defaultLotForm = {
  name: "",
  species: "sheep",
  status: "active" as LivestockLotStatus,
  currentFieldId: NO_FIELD,
  ewes: "0",
  rams: "0",
  lambs: "0",
  wethers: "0",
  unknown: "0",
  notes: "",
};

const defaultMoveForm = {
  toFieldId: "",
  movementDate: new Date().toISOString().split("T")[0],
  moveEntireLot: true,
  ewes: "0",
  rams: "0",
  lambs: "0",
  wethers: "0",
  unknown: "0",
  destinationLotId: NEW_LOT,
  destinationLotName: "",
  notes: "",
};

const defaultCountForm = {
  eventType: "correction" as LivestockLotEventType,
  eventDate: new Date().toISOString().split("T")[0],
  ewesDelta: "0",
  ramsDelta: "0",
  lambsDelta: "0",
  wethersDelta: "0",
  unknownDelta: "0",
  notes: "",
};

const defaultSheepSettings: LivestockSpeciesSettings = {
  id: "default-sheep-settings",
  species: "sheep",
  displayName: "Sheep",
  trackingMode: "lot",
  lotLabel: "Flock",
  classLabels: {
    ewes: "Ewes",
    rams: "Rams",
    lambs: "Lambs",
    wethers: "Wethers",
    unknown: "Unknown",
  },
  allowPartialLotMoves: true,
  allowSplitMerge: true,
  allowIndividualTracking: false,
  requireCorrectionReason: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const toNumber = (value: string) => Number(value || 0);

const formatLocation = (lot: LivestockLotListItem) =>
  lot.currentFieldName
    ? lot.propertyName
      ? `${lot.propertyName} / ${lot.currentFieldName}`
      : lot.currentFieldName
    : "No location";

const formatEventType = (value: string) =>
  value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export default function Lots() {
  const { toast } = useToast();
  const [lotDialogOpen, setLotDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [countDialogOpen, setCountDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<LivestockLotListItem | null>(null);
  const [activeLot, setActiveLot] = useState<LivestockLotListItem | null>(null);
  const [historyLot, setHistoryLot] = useState<LivestockLotListItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [lotForm, setLotForm] = useState(defaultLotForm);
  const [moveForm, setMoveForm] = useState(defaultMoveForm);
  const [countForm, setCountForm] = useState(defaultCountForm);

  const { data: lots = [], isLoading: lotsLoading } = useQuery<LivestockLotListItem[]>({
    queryKey: ["/api/lots"],
  });
  const { data: fields = [] } = useQuery<Field[]>({ queryKey: ["/api/fields"] });
  const { data: properties = [] } = useQuery<Property[]>({ queryKey: ["/api/properties"] });
  const { data: settings = [] } = useQuery<LivestockSpeciesSettings[]>({
    queryKey: ["/api/livestock-settings"],
  });
  const { data: countEvents = [] } = useQuery<LivestockLotCountEvent[]>({
    queryKey: ["/api/lots", historyLot?.id, "count-events"],
    enabled: Boolean(historyLot?.id),
  });

  const sheepSettings = settings.find((item) => item.species === "sheep") ?? defaultSheepSettings;
  const labels = sheepSettings.classLabels ?? defaultSheepSettings.classLabels;

  const propertyNameById = useMemo(() => {
    const names = new Map<string, string>();
    properties.forEach((property) => names.set(property.id, property.name));
    return names;
  }, [properties]);

  const fieldOptions = useMemo(
    () =>
      fields
        .slice()
        .sort((a, b) => {
          const propA = propertyNameById.get(a.propertyId) ?? "";
          const propB = propertyNameById.get(b.propertyId) ?? "";
          return `${propA} ${a.name}`.localeCompare(`${propB} ${b.name}`);
        }),
    [fields, propertyNameById],
  );

  const filteredLots = lots.filter((lot) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return (
      lot.name.toLowerCase().includes(query) ||
      lot.species.toLowerCase().includes(query) ||
      formatLocation(lot).toLowerCase().includes(query)
    );
  });

  const invalidateLivestock = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/lots"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/property-counts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/movements/recent"] });
  };

  const saveLotMutation = useMutation({
    mutationFn: async () => {
      const body = {
        ...lotForm,
        currentFieldId: lotForm.currentFieldId === NO_FIELD ? null : lotForm.currentFieldId,
        ewes: toNumber(lotForm.ewes),
        rams: toNumber(lotForm.rams),
        lambs: toNumber(lotForm.lambs),
        wethers: toNumber(lotForm.wethers),
        unknown: toNumber(lotForm.unknown),
      };
      const res = await apiRequest(
        editingLot ? "PUT" : "POST",
        editingLot ? `/api/lots/${editingLot.id}` : "/api/lots",
        body,
      );
      return res.json();
    },
    onSuccess: () => {
      invalidateLivestock();
      setLotDialogOpen(false);
      setEditingLot(null);
      setLotForm(defaultLotForm);
      toast({ title: "Lot saved", description: "Livestock lot inventory was updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to save lot", description: error.message, variant: "destructive" });
    },
  });

  const moveLotMutation = useMutation({
    mutationFn: async () => {
      if (!activeLot) throw new Error("No lot selected");
      const body = {
        ...moveForm,
        ewes: toNumber(moveForm.ewes),
        rams: toNumber(moveForm.rams),
        lambs: toNumber(moveForm.lambs),
        wethers: toNumber(moveForm.wethers),
        unknown: toNumber(moveForm.unknown),
        destinationLotId:
          !moveForm.moveEntireLot && moveForm.destinationLotId !== NEW_LOT
            ? moveForm.destinationLotId
            : null,
        destinationLotName:
          !moveForm.moveEntireLot && moveForm.destinationLotId === NEW_LOT
            ? moveForm.destinationLotName
            : null,
      };
      const res = await apiRequest("POST", `/api/lots/${activeLot.id}/move`, body);
      return res.json();
    },
    onSuccess: () => {
      invalidateLivestock();
      setMoveDialogOpen(false);
      setActiveLot(null);
      setMoveForm(defaultMoveForm);
      toast({ title: "Lot moved", description: "Movement history and lot counts were updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Move failed", description: error.message, variant: "destructive" });
    },
  });

  const countEventMutation = useMutation({
    mutationFn: async () => {
      if (!activeLot) throw new Error("No lot selected");
      const body = {
        ...countForm,
        ewesDelta: toNumber(countForm.ewesDelta),
        ramsDelta: toNumber(countForm.ramsDelta),
        lambsDelta: toNumber(countForm.lambsDelta),
        wethersDelta: toNumber(countForm.wethersDelta),
        unknownDelta: toNumber(countForm.unknownDelta),
      };
      const res = await apiRequest("POST", `/api/lots/${activeLot.id}/count-events`, body);
      return res.json();
    },
    onSuccess: () => {
      invalidateLivestock();
      if (activeLot) {
        queryClient.invalidateQueries({ queryKey: ["/api/lots", activeLot.id, "count-events"] });
      }
      setCountDialogOpen(false);
      setActiveLot(null);
      setCountForm(defaultCountForm);
      toast({ title: "Count recorded", description: "Lot inventory was adjusted." });
    },
    onError: (error: Error) => {
      toast({ title: "Count update failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteLotMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/lots/${id}`),
    onSuccess: () => {
      invalidateLivestock();
      toast({ title: "Lot deleted", description: "The livestock lot was removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: async (patch: Partial<LivestockSpeciesSettings>) => {
      const body = {
        species: "sheep",
        displayName: sheepSettings.displayName,
        trackingMode: sheepSettings.trackingMode,
        lotLabel: sheepSettings.lotLabel,
        classLabels: sheepSettings.classLabels,
        allowPartialLotMoves: sheepSettings.allowPartialLotMoves,
        allowSplitMerge: sheepSettings.allowSplitMerge,
        allowIndividualTracking: sheepSettings.allowIndividualTracking,
        requireCorrectionReason: sheepSettings.requireCorrectionReason,
        ...patch,
      };
      const res = await apiRequest("PUT", "/api/livestock-settings/sheep", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/livestock-settings"] });
    },
    onError: (error: Error) => {
      toast({ title: "Settings update failed", description: error.message, variant: "destructive" });
    },
  });

  const openCreateLot = () => {
    setEditingLot(null);
    setLotForm(defaultLotForm);
    setLotDialogOpen(true);
  };

  const openEditLot = (lot: LivestockLotListItem) => {
    setEditingLot(lot);
    setLotForm({
      name: lot.name,
      species: lot.species,
      status: lot.status as LivestockLotStatus,
      currentFieldId: lot.currentFieldId || NO_FIELD,
      ewes: String(lot.ewes),
      rams: String(lot.rams),
      lambs: String(lot.lambs),
      wethers: String(lot.wethers),
      unknown: String(lot.unknown),
      notes: lot.notes || "",
    });
    setLotDialogOpen(true);
  };

  const openMoveLot = (lot: LivestockLotListItem) => {
    setActiveLot(lot);
    setMoveForm({
      ...defaultMoveForm,
      destinationLotName: `${lot.name} split`,
    });
    setMoveDialogOpen(true);
  };

  const openCountEvent = (lot: LivestockLotListItem) => {
    setActiveLot(lot);
    setCountForm(defaultCountForm);
    setCountDialogOpen(true);
  };

  const countInputs = (
    form: typeof lotForm | typeof moveForm,
    onChange: (key: "ewes" | "rams" | "lambs" | "wethers" | "unknown", value: string) => void,
    disabled = false,
  ) => (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {(["ewes", "rams", "lambs", "wethers", "unknown"] as const).map((key) => (
        <div key={key} className="space-y-2">
          <Label htmlFor={`lot-${key}`}>{labels[key]}</Label>
          <Input
            id={`lot-${key}`}
            type="number"
            min="0"
            value={(form as any)[key]}
            disabled={disabled}
            onChange={(event) => onChange(key, event.target.value)}
            data-testid={`input-lot-${key}`}
          />
        </div>
      ))}
    </div>
  );

  const deltaInputs = (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {(["ewesDelta", "ramsDelta", "lambsDelta", "wethersDelta", "unknownDelta"] as const).map((key) => {
        const labelKey = key.replace("Delta", "") as keyof typeof labels;
        return (
          <div key={key} className="space-y-2">
            <Label htmlFor={`event-${key}`}>{labels[labelKey]}</Label>
            <Input
              id={`event-${key}`}
              type="number"
              value={countForm[key]}
              onChange={(event) => setCountForm({ ...countForm, [key]: event.target.value })}
              data-testid={`input-event-${key}`}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Lots
          </h1>
          <p className="text-muted-foreground">Sheep lot inventory by field and class</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setSettingsOpen((open) => !open)} data-testid="button-lot-settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button onClick={openCreateLot} data-testid="button-add-lot">
            <Plus className="h-4 w-4 mr-2" />
            Add Lot
          </Button>
        </div>
      </div>

      {settingsOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sheep Tracking Settings</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Tracking mode</Label>
              <Select
                value={sheepSettings.trackingMode}
                onValueChange={(value) =>
                  settingsMutation.mutate({ trackingMode: value as LivestockTrackingMode })
                }
              >
                <SelectTrigger data-testid="select-sheep-tracking-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {livestockTrackingModeEnum.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {formatEventType(mode)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-3 text-sm font-medium">
              <Checkbox
                checked={sheepSettings.allowPartialLotMoves}
                onCheckedChange={(checked) => settingsMutation.mutate({ allowPartialLotMoves: checked === true })}
              />
              Allow partial lot moves
            </label>
            <label className="flex items-center gap-3 text-sm font-medium">
              <Checkbox
                checked={sheepSettings.allowSplitMerge}
                onCheckedChange={(checked) => settingsMutation.mutate({ allowSplitMerge: checked === true })}
              />
              Allow split and merge
            </label>
            <label className="flex items-center gap-3 text-sm font-medium">
              <Checkbox
                checked={sheepSettings.allowIndividualTracking}
                onCheckedChange={(checked) => settingsMutation.mutate({ allowIndividualTracking: checked === true })}
              />
              Allow individual sheep
            </label>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search lots by name, species, or location..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="sm:max-w-md"
          data-testid="input-search-lots"
        />
        <span className="text-sm text-muted-foreground">
          {filteredLots.length} lot{filteredLots.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">{labels.ewes}</TableHead>
              <TableHead className="text-right">{labels.rams}</TableHead>
              <TableHead className="text-right">{labels.lambs}</TableHead>
              <TableHead className="hidden md:table-cell text-right">{labels.wethers}</TableHead>
              <TableHead className="hidden md:table-cell text-right">{labels.unknown}</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lotsLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  Loading lots...
                </TableCell>
              </TableRow>
            ) : filteredLots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  No lots found
                </TableCell>
              </TableRow>
            ) : (
              filteredLots.map((lot) => (
                <TableRow key={lot.id} data-testid={`row-lot-${lot.id}`}>
                  <TableCell>
                    <div className="font-medium">{lot.name}</div>
                    <div className="text-xs capitalize text-muted-foreground">{lot.species}</div>
                  </TableCell>
                  <TableCell>{formatLocation(lot)}</TableCell>
                  <TableCell className="text-right font-mono">{lot.ewes}</TableCell>
                  <TableCell className="text-right font-mono">{lot.rams}</TableCell>
                  <TableCell className="text-right font-mono">{lot.lambs}</TableCell>
                  <TableCell className="hidden md:table-cell text-right font-mono">{lot.wethers}</TableCell>
                  <TableCell className="hidden md:table-cell text-right font-mono">{lot.unknown}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{lot.totalCount}</TableCell>
                  <TableCell>
                    <Badge variant={lot.status === "active" ? "default" : "outline"} className="capitalize">
                      {lot.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openMoveLot(lot)} title="Move lot">
                        <MoveRight className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openCountEvent(lot)} title="Record count event">
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setHistoryLot(lot)} title="History">
                        <History className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditLot(lot)} title="Edit lot">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Delete this lot and its history?")) {
                            deleteLotMutation.mutate(lot.id);
                          }
                        }}
                        title="Delete lot"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {historyLot && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{historyLot.name} Count History</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setHistoryLot(null)}>
              Close
            </Button>
          </CardHeader>
          <CardContent>
            {countEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No count events recorded.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">{labels.ewes}</TableHead>
                    <TableHead className="text-right">{labels.rams}</TableHead>
                    <TableHead className="text-right">{labels.lambs}</TableHead>
                    <TableHead className="text-right">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{String(event.eventDate).split("T")[0]}</TableCell>
                      <TableCell>{formatEventType(event.eventType)}</TableCell>
                      <TableCell className="text-right font-mono">{event.ewesDelta}</TableCell>
                      <TableCell className="text-right font-mono">{event.ramsDelta}</TableCell>
                      <TableCell className="text-right font-mono">{event.lambsDelta}</TableCell>
                      <TableCell className="text-right">{event.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={lotDialogOpen} onOpenChange={setLotDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingLot ? "Edit Lot" : "Add Lot"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lot-name">Name</Label>
                <Input
                  id="lot-name"
                  value={lotForm.name}
                  onChange={(event) => setLotForm({ ...lotForm, name: event.target.value })}
                  data-testid="input-lot-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lot-field">Location</Label>
                <Select
                  value={lotForm.currentFieldId}
                  onValueChange={(value) => setLotForm({ ...lotForm, currentFieldId: value })}
                >
                  <SelectTrigger id="lot-field" data-testid="select-lot-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_FIELD}>No location</SelectItem>
                    {fieldOptions.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {propertyNameById.get(field.propertyId)
                          ? `${propertyNameById.get(field.propertyId)} / ${field.name}`
                          : field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {countInputs(lotForm, (key, value) => setLotForm({ ...lotForm, [key]: value }))}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lot-status">Status</Label>
                <Select
                  value={lotForm.status}
                  onValueChange={(value) => setLotForm({ ...lotForm, status: value as LivestockLotStatus })}
                >
                  <SelectTrigger id="lot-status" data-testid="select-lot-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {livestockLotStatusEnum.map((status) => (
                      <SelectItem key={status} value={status}>
                        {formatEventType(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lot-notes">Notes</Label>
                <Textarea
                  id="lot-notes"
                  value={lotForm.notes}
                  onChange={(event) => setLotForm({ ...lotForm, notes: event.target.value })}
                  data-testid="textarea-lot-notes"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLotDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => saveLotMutation.mutate()} disabled={saveLotMutation.isPending}>
                {saveLotMutation.isPending ? "Saving..." : "Save Lot"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Move {activeLot?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Destination field</Label>
                <Select
                  value={moveForm.toFieldId}
                  onValueChange={(value) => setMoveForm({ ...moveForm, toFieldId: value })}
                >
                  <SelectTrigger data-testid="select-move-lot-field">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {propertyNameById.get(field.propertyId)
                          ? `${propertyNameById.get(field.propertyId)} / ${field.name}`
                          : field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Movement date</Label>
                <Input
                  type="date"
                  value={moveForm.movementDate}
                  onChange={(event) => setMoveForm({ ...moveForm, movementDate: event.target.value })}
                  data-testid="input-move-lot-date"
                />
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm font-medium">
              <Checkbox
                checked={moveForm.moveEntireLot}
                onCheckedChange={(checked) => setMoveForm({ ...moveForm, moveEntireLot: checked === true })}
                disabled={!sheepSettings.allowPartialLotMoves}
              />
              Move entire lot
            </label>
            {countInputs(
              moveForm,
              (key, value) => setMoveForm({ ...moveForm, [key]: value }),
              moveForm.moveEntireLot,
            )}
            {!moveForm.moveEntireLot && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Destination lot</Label>
                  <Select
                    value={moveForm.destinationLotId}
                    onValueChange={(value) => setMoveForm({ ...moveForm, destinationLotId: value })}
                  >
                    <SelectTrigger data-testid="select-destination-lot">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NEW_LOT}>Create new lot</SelectItem>
                      {lots
                        .filter((lot) => lot.id !== activeLot?.id && lot.species === activeLot?.species)
                        .map((lot) => (
                          <SelectItem key={lot.id} value={lot.id}>
                            {lot.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {moveForm.destinationLotId === NEW_LOT && (
                  <div className="space-y-2">
                    <Label>New lot name</Label>
                    <Input
                      value={moveForm.destinationLotName}
                      onChange={(event) => setMoveForm({ ...moveForm, destinationLotName: event.target.value })}
                      data-testid="input-destination-lot-name"
                    />
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={moveForm.notes}
                onChange={(event) => setMoveForm({ ...moveForm, notes: event.target.value })}
                data-testid="textarea-move-lot-notes"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => moveLotMutation.mutate()}
                disabled={moveLotMutation.isPending || !moveForm.toFieldId}
              >
                {moveLotMutation.isPending ? "Moving..." : "Move Lot"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={countDialogOpen} onOpenChange={setCountDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Record Count Change</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Event type</Label>
                <Select
                  value={countForm.eventType}
                  onValueChange={(value) => setCountForm({ ...countForm, eventType: value as LivestockLotEventType })}
                >
                  <SelectTrigger data-testid="select-count-event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {livestockLotEventTypeEnum
                      .filter((type) => type !== "created" && type !== "split" && type !== "merge")
                      .map((type) => (
                        <SelectItem key={type} value={type}>
                          {formatEventType(type)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Event date</Label>
                <Input
                  type="date"
                  value={countForm.eventDate}
                  onChange={(event) => setCountForm({ ...countForm, eventDate: event.target.value })}
                  data-testid="input-count-event-date"
                />
              </div>
            </div>
            {deltaInputs}
            <div className="space-y-2">
              <Label>Reason or notes</Label>
              <Textarea
                value={countForm.notes}
                onChange={(event) => setCountForm({ ...countForm, notes: event.target.value })}
                data-testid="textarea-count-event-notes"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCountDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => countEventMutation.mutate()} disabled={countEventMutation.isPending}>
                {countEventMutation.isPending ? "Recording..." : "Record Change"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
