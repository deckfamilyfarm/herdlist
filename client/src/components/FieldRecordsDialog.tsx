import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface FieldRecordField {
  id: string;
  name: string;
  acres?: number | string | null;
}

interface FieldRecordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field?: FieldRecordField;
}

interface HayRecord {
  id: string;
  hayType: "balage" | "dry_hay";
  balingDate: string | Date;
  baleCount: number;
  baleWeightLbs: number | string;
  dryMatterPercent: number | string;
  acresCut: number | string;
  storageLocation?: string | null;
  notes?: string | null;
  totalDmTons: number;
  tonDmPerAcre: number | null;
}

interface AmendmentRecord {
  id: string;
  amendmentType: "reseeding" | "manure" | "lime";
  applicationDate: string | Date;
  acresTreated: number | string;
  notes?: string | null;
  seedNotes?: string | null;
  manureRateYardsPerAcre?: number | string | null;
  manureSource?: string | null;
  spreaderType?: "vertical_beater" | "horizontal_beater" | null;
  limeType?: string | null;
  limeTonsPerAcre?: number | string | null;
}

const hayTypeLabel = {
  balage: "Balage",
  dry_hay: "Dry Hay",
} as const;

const amendmentTypeLabel = {
  reseeding: "Re-seeding",
  manure: "Manure",
  lime: "Lime",
} as const;

const spreaderTypeLabel = {
  vertical_beater: "Vertical beater",
  horizontal_beater: "Horizontal beater",
} as const;

const formatDateInput = (value: string | Date | null | undefined) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.includes("T") ? value.slice(0, 10) : value;
};

const formatDateDisplay = (value: string | Date | null | undefined) => {
  return formatDateInput(value) || "-";
};

const formatNumber = (value: number | string | null | undefined, digits = 2) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(digits) : "-";
};

const buildHayForm = (field?: FieldRecordField, record?: HayRecord) => ({
  hayType: record?.hayType ?? "balage",
  balingDate: formatDateInput(record?.balingDate),
  baleCount: record?.baleCount?.toString() ?? "",
  baleWeightLbs: record?.baleWeightLbs?.toString() ?? "",
  dryMatterPercent: record?.dryMatterPercent?.toString() ?? "",
  acresCut: record?.acresCut?.toString() ?? field?.acres?.toString() ?? "",
  storageLocation: record?.storageLocation ?? "",
  notes: record?.notes ?? "",
});

const buildAmendmentForm = (field?: FieldRecordField, record?: AmendmentRecord) => ({
  amendmentType: record?.amendmentType ?? "reseeding",
  applicationDate: formatDateInput(record?.applicationDate),
  acresTreated: record?.acresTreated?.toString() ?? field?.acres?.toString() ?? "",
  seedNotes: record?.seedNotes ?? "",
  manureRateYardsPerAcre: record?.manureRateYardsPerAcre?.toString() ?? "",
  manureSource: record?.manureSource ?? "",
  spreaderType: record?.spreaderType ?? "vertical_beater",
  limeType: record?.limeType ?? "",
  limeTonsPerAcre: record?.limeTonsPerAcre?.toString() ?? "",
  notes: record?.notes ?? "",
});

export function FieldRecordsDialog({ open, onOpenChange, field }: FieldRecordsDialogProps) {
  const { toast } = useToast();
  const [editingHayId, setEditingHayId] = useState<string | null>(null);
  const [editingAmendmentId, setEditingAmendmentId] = useState<string | null>(null);
  const [hayForm, setHayForm] = useState(buildHayForm(field));
  const [amendmentForm, setAmendmentForm] = useState(buildAmendmentForm(field));

  const { data: hayRecords = [] } = useQuery<HayRecord[]>({
    queryKey: [`/api/fields/${field?.id}/hay-records`],
    enabled: open && !!field?.id,
  });

  const { data: amendmentRecords = [] } = useQuery<AmendmentRecord[]>({
    queryKey: [`/api/fields/${field?.id}/amendment-records`],
    enabled: open && !!field?.id,
  });

  useEffect(() => {
    if (open) {
      setEditingHayId(null);
      setEditingAmendmentId(null);
      setHayForm(buildHayForm(field));
      setAmendmentForm(buildAmendmentForm(field));
    }
  }, [field, open]);

  const invalidateHayQueries = () => {
    if (field?.id) {
      queryClient.invalidateQueries({ queryKey: [`/api/fields/${field.id}/hay-records`] });
    }
    queryClient.invalidateQueries({
      predicate: (query) => String(query.queryKey[0]).startsWith("/api/hay-records"),
    });
  };

  const invalidateAmendmentQueries = () => {
    if (field?.id) {
      queryClient.invalidateQueries({ queryKey: [`/api/fields/${field.id}/amendment-records`] });
    }
  };

  const saveHayMutation = useMutation({
    mutationFn: async () => {
      if (!field?.id) throw new Error("Field is required");
      const url = editingHayId
        ? `/api/hay-records/${editingHayId}`
        : `/api/fields/${field.id}/hay-records`;
      const method = editingHayId ? "PUT" : "POST";
      const res = await apiRequest(method, url, hayForm);
      return res.json();
    },
    onSuccess: () => {
      invalidateHayQueries();
      setEditingHayId(null);
      setHayForm(buildHayForm(field));
      toast({ title: "Success", description: "Hay record saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteHayMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/hay-records/${id}`);
    },
    onSuccess: () => {
      invalidateHayQueries();
      toast({ title: "Success", description: "Hay record deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveAmendmentMutation = useMutation({
    mutationFn: async () => {
      if (!field?.id) throw new Error("Field is required");
      const url = editingAmendmentId
        ? `/api/amendment-records/${editingAmendmentId}`
        : `/api/fields/${field.id}/amendment-records`;
      const method = editingAmendmentId ? "PUT" : "POST";
      const res = await apiRequest(method, url, amendmentForm);
      return res.json();
    },
    onSuccess: () => {
      invalidateAmendmentQueries();
      setEditingAmendmentId(null);
      setAmendmentForm(buildAmendmentForm(field));
      toast({ title: "Success", description: "Amendment record saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteAmendmentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/amendment-records/${id}`);
    },
    onSuccess: () => {
      invalidateAmendmentQueries();
      toast({ title: "Success", description: "Amendment record deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEditHay = (record: HayRecord) => {
    setEditingHayId(record.id);
    setHayForm(buildHayForm(field, record));
  };

  const handleEditAmendment = (record: AmendmentRecord) => {
    setEditingAmendmentId(record.id);
    setAmendmentForm(buildAmendmentForm(field, record));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto" data-testid="dialog-field-records">
        <DialogHeader>
          <DialogTitle>{field?.name ? `${field.name} Records` : "Field Records"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="hay">
          <TabsList>
            <TabsTrigger value="hay">Hay</TabsTrigger>
            <TabsTrigger value="amendments">Amendments</TabsTrigger>
          </TabsList>

          <TabsContent value="hay" className="space-y-4">
            <form
              className="grid gap-4 rounded-md border p-4 md:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                saveHayMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label>Hay Type *</Label>
                <Select
                  value={hayForm.hayType}
                  onValueChange={(value: "balage" | "dry_hay") => setHayForm({ ...hayForm, hayType: value })}
                >
                  <SelectTrigger data-testid="select-hay-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balage">Balage</SelectItem>
                    <SelectItem value="dry_hay">Dry Hay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="balingDate">Baling Date *</Label>
                <Input
                  id="balingDate"
                  type="date"
                  value={hayForm.balingDate}
                  onChange={(event) => setHayForm({ ...hayForm, balingDate: event.target.value })}
                  required
                  data-testid="input-hay-baling-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acresCut">Acres Cut *</Label>
                <Input
                  id="acresCut"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={hayForm.acresCut}
                  onChange={(event) => setHayForm({ ...hayForm, acresCut: event.target.value })}
                  required
                  data-testid="input-hay-acres-cut"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baleCount">Bales *</Label>
                <Input
                  id="baleCount"
                  type="number"
                  min="1"
                  step="1"
                  value={hayForm.baleCount}
                  onChange={(event) => setHayForm({ ...hayForm, baleCount: event.target.value })}
                  required
                  data-testid="input-hay-bale-count"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baleWeightLbs">Bale Weight Lbs *</Label>
                <Input
                  id="baleWeightLbs"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={hayForm.baleWeightLbs}
                  onChange={(event) => setHayForm({ ...hayForm, baleWeightLbs: event.target.value })}
                  required
                  data-testid="input-hay-bale-weight"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dryMatterPercent">Dry Matter % *</Label>
                <Input
                  id="dryMatterPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={hayForm.dryMatterPercent}
                  onChange={(event) => setHayForm({ ...hayForm, dryMatterPercent: event.target.value })}
                  required
                  data-testid="input-hay-dry-matter"
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="storageLocation">Bale Storage Location</Label>
                <Input
                  id="storageLocation"
                  value={hayForm.storageLocation}
                  onChange={(event) => setHayForm({ ...hayForm, storageLocation: event.target.value })}
                  data-testid="input-hay-storage-location"
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="hayNotes">Notes</Label>
                <Textarea
                  id="hayNotes"
                  value={hayForm.notes}
                  onChange={(event) => setHayForm({ ...hayForm, notes: event.target.value })}
                  data-testid="textarea-hay-notes"
                />
              </div>
              <div className="flex gap-2 md:col-span-3">
                <Button type="submit" disabled={saveHayMutation.isPending}>
                  {editingHayId ? "Update Hay Record" : "Add Hay Record"}
                </Button>
                {editingHayId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingHayId(null);
                      setHayForm(buildHayForm(field));
                    }}
                  >
                    Cancel Edit
                  </Button>
                )}
              </div>
            </form>

            <div className="space-y-2">
              {hayRecords.length === 0 ? (
                <p className="rounded-md border p-4 text-sm text-muted-foreground">No hay records yet</p>
              ) : (
                hayRecords.map((record) => (
                  <div key={record.id} className="rounded-md border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1 text-sm">
                        <div className="font-medium">
                          {hayTypeLabel[record.hayType]} on {formatDateDisplay(record.balingDate)}
                        </div>
                        <div className="text-muted-foreground">
                          {record.baleCount} bales x {formatNumber(record.baleWeightLbs)} lbs at{" "}
                          {formatNumber(record.dryMatterPercent)}% DM
                        </div>
                        <div>
                          {formatNumber(record.totalDmTons)} tons DM, {formatNumber(record.tonDmPerAcre)} Ton DM/Acre
                        </div>
                        {record.storageLocation && <div>Stored at: {record.storageLocation}</div>}
                        {record.notes && <div className="whitespace-pre-wrap">{record.notes}</div>}
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleEditHay(record)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this hay record?")) {
                              deleteHayMutation.mutate(record.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="amendments" className="space-y-4">
            <form
              className="grid gap-4 rounded-md border p-4 md:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                saveAmendmentMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label>Amendment Type *</Label>
                <Select
                  value={amendmentForm.amendmentType}
                  onValueChange={(value: "reseeding" | "manure" | "lime") =>
                    setAmendmentForm({ ...amendmentForm, amendmentType: value })
                  }
                >
                  <SelectTrigger data-testid="select-amendment-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reseeding">Re-seeding</SelectItem>
                    <SelectItem value="manure">Manure</SelectItem>
                    <SelectItem value="lime">Lime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="applicationDate">Application Date *</Label>
                <Input
                  id="applicationDate"
                  type="date"
                  value={amendmentForm.applicationDate}
                  onChange={(event) => setAmendmentForm({ ...amendmentForm, applicationDate: event.target.value })}
                  required
                  data-testid="input-amendment-application-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acresTreated">Acres Treated *</Label>
                <Input
                  id="acresTreated"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amendmentForm.acresTreated}
                  onChange={(event) => setAmendmentForm({ ...amendmentForm, acresTreated: event.target.value })}
                  required
                  data-testid="input-amendment-acres-treated"
                />
              </div>

              {amendmentForm.amendmentType === "reseeding" && (
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="seedNotes">Seed Notes *</Label>
                  <Textarea
                    id="seedNotes"
                    value={amendmentForm.seedNotes}
                    onChange={(event) => setAmendmentForm({ ...amendmentForm, seedNotes: event.target.value })}
                    required
                    data-testid="textarea-amendment-seed-notes"
                  />
                </div>
              )}

              {amendmentForm.amendmentType === "manure" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="manureRate">Rate Yards/Acre *</Label>
                    <Input
                      id="manureRate"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amendmentForm.manureRateYardsPerAcre}
                      onChange={(event) =>
                        setAmendmentForm({ ...amendmentForm, manureRateYardsPerAcre: event.target.value })
                      }
                      required
                      data-testid="input-amendment-manure-rate"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manureSource">Manure Source *</Label>
                    <Input
                      id="manureSource"
                      value={amendmentForm.manureSource}
                      onChange={(event) => setAmendmentForm({ ...amendmentForm, manureSource: event.target.value })}
                      required
                      data-testid="input-amendment-manure-source"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Spreader *</Label>
                    <Select
                      value={amendmentForm.spreaderType}
                      onValueChange={(value: "vertical_beater" | "horizontal_beater") =>
                        setAmendmentForm({ ...amendmentForm, spreaderType: value })
                      }
                    >
                      <SelectTrigger data-testid="select-amendment-spreader">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vertical_beater">Vertical beater</SelectItem>
                        <SelectItem value="horizontal_beater">Horizontal beater</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {amendmentForm.amendmentType === "lime" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="limeType">Lime Type *</Label>
                    <Input
                      id="limeType"
                      value={amendmentForm.limeType}
                      onChange={(event) => setAmendmentForm({ ...amendmentForm, limeType: event.target.value })}
                      required
                      data-testid="input-amendment-lime-type"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="limeTons">Tons/Acre *</Label>
                    <Input
                      id="limeTons"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amendmentForm.limeTonsPerAcre}
                      onChange={(event) => setAmendmentForm({ ...amendmentForm, limeTonsPerAcre: event.target.value })}
                      required
                      data-testid="input-amendment-lime-tons"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="amendmentNotes">Notes</Label>
                <Textarea
                  id="amendmentNotes"
                  value={amendmentForm.notes}
                  onChange={(event) => setAmendmentForm({ ...amendmentForm, notes: event.target.value })}
                  data-testid="textarea-amendment-notes"
                />
              </div>
              <div className="flex gap-2 md:col-span-3">
                <Button type="submit" disabled={saveAmendmentMutation.isPending}>
                  {editingAmendmentId ? "Update Amendment Record" : "Add Amendment Record"}
                </Button>
                {editingAmendmentId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingAmendmentId(null);
                      setAmendmentForm(buildAmendmentForm(field));
                    }}
                  >
                    Cancel Edit
                  </Button>
                )}
              </div>
            </form>

            <div className="space-y-2">
              {amendmentRecords.length === 0 ? (
                <p className="rounded-md border p-4 text-sm text-muted-foreground">No amendment records yet</p>
              ) : (
                amendmentRecords.map((record) => (
                  <div key={record.id} className="rounded-md border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1 text-sm">
                        <div className="font-medium">
                          {amendmentTypeLabel[record.amendmentType]} on {formatDateDisplay(record.applicationDate)}
                        </div>
                        <div className="text-muted-foreground">
                          {formatNumber(record.acresTreated)} acres treated
                        </div>
                        {record.amendmentType === "reseeding" && record.seedNotes && (
                          <div className="whitespace-pre-wrap">Seed: {record.seedNotes}</div>
                        )}
                        {record.amendmentType === "manure" && (
                          <div>
                            {formatNumber(record.manureRateYardsPerAcre)} yards/acre from {record.manureSource || "-"} using{" "}
                            {record.spreaderType ? spreaderTypeLabel[record.spreaderType] : "-"}
                          </div>
                        )}
                        {record.amendmentType === "lime" && (
                          <div>
                            {record.limeType || "-"} at {formatNumber(record.limeTonsPerAcre)} tons/acre
                          </div>
                        )}
                        {record.notes && <div className="whitespace-pre-wrap">{record.notes}</div>}
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleEditAmendment(record)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this amendment record?")) {
                              deleteAmendmentMutation.mutate(record.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
