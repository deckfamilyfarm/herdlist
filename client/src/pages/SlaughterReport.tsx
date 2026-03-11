import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { FileDown, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SlaughterRecord, InsertSlaughterRecord, Animal } from "@shared/schema";

type RecordType = "slaughtered" | "sold";

type SlaughterFormData = {
  animalId: string;
  recordType: RecordType;
  slaughterDate: string;
  liveWeight: string;
  hangingWeight: string;
  processor: string;
  buyer: string;
  pricePerLb: string;
};

const createEmptyFormData = (): SlaughterFormData => ({
  animalId: "",
  recordType: "slaughtered",
  slaughterDate: "",
  liveWeight: "",
  hangingWeight: "",
  processor: "",
  buyer: "",
  pricePerLb: "",
});

const toDateInputValue = (value: SlaughterRecord["slaughterDate"]) => {
  if (!value) return "";
  const raw = value instanceof Date ? value.toISOString() : String(value);
  return raw.includes("T") ? raw.slice(0, 10) : raw;
};

const getRecordType = (record: Partial<SlaughterRecord>): RecordType => {
  const raw = String((record as any).recordType ?? "")
    .trim()
    .toLowerCase();
  if (raw === "sold") return "sold";
  if (raw === "slaughtered") return "slaughtered";

  const processor = String((record as any).processor ?? "");
  if (processor.startsWith("SOLD:")) return "sold";
  if ((record as any).buyer || (record as any).pricePerLb) return "sold";
  return "slaughtered";
};

const getDisplayBuyer = (record: Partial<SlaughterRecord>): string | null => {
  const buyer = (record as any).buyer;
  if (buyer) return String(buyer);
  const processor = String((record as any).processor ?? "");
  if (processor.startsWith("SOLD:")) {
    const inferred = processor.slice(5).trim();
    return inferred || null;
  }
  return null;
};

export default function SlaughterReport() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SlaughterFormData>(createEmptyFormData());

  const isEditing = editingRecordId !== null;

  const { data: slaughterRecords = [], isLoading } = useQuery<SlaughterRecord[]>({
    queryKey: ["/api/slaughter-records"],
  });

  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
  });

  const availableAnimals = useMemo(
    () =>
      animals.filter((animal) => {
        const normalizedStatus = String(animal.status ?? "active").trim().toLowerCase();
        return normalizedStatus === "" || normalizedStatus === "active";
      }),
    [animals],
  );

  const resetDialog = () => {
    setDialogOpen(false);
    setEditingRecordId(null);
    setFormData(createEmptyFormData());
  };

  const invalidateAfterSave = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/slaughter-records"] });
    queryClient.invalidateQueries({ queryKey: ["/api/animals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/property-counts"] });
  };

  const createSlaughterRecordMutation = useMutation({
    mutationFn: async (data: InsertSlaughterRecord) => {
      const res = await apiRequest("POST", "/api/slaughter-records", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateAfterSave();
      toast({
        title: "Success",
        description: "Record added successfully",
      });
      resetDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSlaughterRecordMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertSlaughterRecord }) => {
      const res = await apiRequest("PUT", `/api/slaughter-records/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateAfterSave();
      toast({
        title: "Success",
        description: "Record updated successfully",
      });
      resetDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      resetDialog();
      return;
    }
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingRecordId(null);
    setFormData(createEmptyFormData());
    setDialogOpen(true);
  };

  const openEditDialog = (record: SlaughterRecord) => {
    setEditingRecordId(record.id);
    setFormData({
      animalId: record.animalId,
      recordType: getRecordType(record),
      slaughterDate: toDateInputValue(record.slaughterDate),
      liveWeight: record.liveWeight ? String(record.liveWeight) : "",
      hangingWeight: record.hangingWeight ? String(record.hangingWeight) : "",
      processor: record.processor ?? "",
      buyer: getDisplayBuyer(record) ?? "",
      pricePerLb: record.pricePerLb ? String(record.pricePerLb) : "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isSold = formData.recordType === "sold";
    const submitData: InsertSlaughterRecord = {
      animalId: formData.animalId,
      recordType: formData.recordType,
      slaughterDate: formData.slaughterDate,
      // backend computes ageMonths; we omit it
      liveWeight: formData.liveWeight || undefined,
      hangingWeight: isSold ? undefined : formData.hangingWeight || undefined,
      processor: isSold ? undefined : formData.processor || undefined,
      buyer: isSold ? formData.buyer || undefined : undefined,
      pricePerLb: isSold ? formData.pricePerLb || undefined : undefined,
    };

    if (isEditing && editingRecordId) {
      updateSlaughterRecordMutation.mutate({ id: editingRecordId, data: submitData });
      return;
    }

    createSlaughterRecordMutation.mutate(submitData);
  };

  const slaughteredRecords = useMemo(
    () => slaughterRecords.filter((record) => getRecordType(record) === "slaughtered"),
    [slaughterRecords],
  );
  const soldRecords = useMemo(
    () => slaughterRecords.filter((record) => getRecordType(record) === "sold"),
    [slaughterRecords],
  );

  const avgAge =
    slaughterRecords.length > 0
      ? Math.round(
          slaughterRecords.reduce((sum, r) => sum + (r.ageMonths || 0), 0) /
            slaughterRecords.length,
        )
      : 0;

  const recordsWithYield = slaughteredRecords.filter(
    (record) => record.liveWeight && record.hangingWeight,
  );
  const avgYield =
    recordsWithYield.length > 0
      ? Math.round(
          recordsWithYield.reduce((sum, record) => {
            const yield_ =
              (parseFloat(record.hangingWeight!) / parseFloat(record.liveWeight!)) *
              100;
            return sum + yield_;
          }, 0) / recordsWithYield.length,
        )
      : 0;

  const getAnimalLabel = (animalId: string) => {
    const animal = animals.find((a) => a.id === animalId);
    if (!animal) return animalId;
    return `${animal.tagNumber}${animal.phenotype ? ` (${animal.phenotype})` : ""}`;
  };

  const isSaving = createSlaughterRecordMutation.isPending || updateSlaughterRecordMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Slaughter/Sold
          </h1>
          <p className="text-muted-foreground">
            Track slaughter outcomes and sold animals
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-export">
            <FileDown className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={openCreateDialog} data-testid="button-add-record">
            <Plus className="h-4 w-4 mr-2" />
            Add Record
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-records">
              {slaughterRecords.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Slaughtered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-slaughtered">
              {slaughteredRecords.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-sold">
              {soldRecords.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg Slaughter Yield %</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-yield">
              {avgYield}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Avg age: {avgAge} months</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading records...</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Slaughter/Sold Records</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Animal</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Age (Mo)</TableHead>
                  <TableHead>Live Weight</TableHead>
                  <TableHead>Hanging Weight</TableHead>
                  <TableHead>Yield %</TableHead>
                  <TableHead>Processor / Buyer</TableHead>
                  <TableHead>Price / lb</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slaughterRecords.map((record) => {
                  const type = getRecordType(record);
                  const yieldPercent =
                    type === "slaughtered" && record.liveWeight && record.hangingWeight
                      ? (
                          (parseFloat(record.hangingWeight) /
                            parseFloat(record.liveWeight)) *
                          100
                        ).toFixed(1)
                      : "-";

                  return (
                    <TableRow
                      key={record.id}
                      data-testid={`row-slaughter-${record.id}`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openEditDialog(record)}
                    >
                      <TableCell className="font-mono font-medium">
                        {getAnimalLabel(record.animalId)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={type === "sold" ? "default" : "secondary"}>
                          {type === "sold" ? "Sold" : "Slaughtered"}
                        </Badge>
                      </TableCell>
                      <TableCell>{toDateInputValue(record.slaughterDate)}</TableCell>
                      <TableCell className="font-mono">
                        {record.ageMonths || "-"}
                      </TableCell>
                      <TableCell className="font-mono">
                        {record.liveWeight ? `${record.liveWeight} lbs` : "-"}
                      </TableCell>
                      <TableCell className="font-mono">
                        {type === "slaughtered" && record.hangingWeight
                          ? `${record.hangingWeight} lbs`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {yieldPercent}
                          {yieldPercent !== "-" ? "%" : ""}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {type === "sold"
                          ? getDisplayBuyer(record) || "-"
                          : record.processor || "-"}
                      </TableCell>
                      <TableCell className="font-mono">
                        {type === "sold" && record.pricePerLb
                          ? `$${record.pricePerLb}`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-md" data-testid="dialog-add-slaughter">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Slaughter/Sold Record" : "Add Slaughter/Sold Record"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update details and save changes"
                : "Enter slaughter/sold details for this animal"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recordType">Record Type *</Label>
              <Select
                value={formData.recordType}
                onValueChange={(value) =>
                  setFormData({ ...formData, recordType: value as RecordType })
                }
              >
                <SelectTrigger id="recordType" data-testid="select-record-type">
                  <SelectValue placeholder="Select record type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slaughtered">Slaughtered</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="animal">Animal *</Label>
              {isEditing ? (
                <Input id="animal" value={getAnimalLabel(formData.animalId)} readOnly data-testid="input-animal-readonly" />
              ) : (
                <Select
                  value={formData.animalId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, animalId: value })
                  }
                >
                  <SelectTrigger id="animal" data-testid="select-animal">
                    <SelectValue placeholder="Select active animal" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAnimals.map((animal) => (
                      <SelectItem key={animal.id} value={animal.id}>
                        {animal.tagNumber}
                        {animal.phenotype ? ` (${animal.phenotype})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slaughterDate">Date *</Label>
              <Input
                id="slaughterDate"
                type="date"
                value={formData.slaughterDate}
                onChange={(e) =>
                  setFormData({ ...formData, slaughterDate: e.target.value })
                }
                required
                data-testid="input-slaughter-date"
              />
            </div>

            <div className={`grid gap-4 ${formData.recordType === "sold" ? "grid-cols-1" : "grid-cols-2"}`}>
              <div className="space-y-2">
                <Label htmlFor="liveWeight">Live Weight (lbs) *</Label>
                <Input
                  id="liveWeight"
                  type="number"
                  step="0.01"
                  value={formData.liveWeight}
                  onChange={(e) =>
                    setFormData({ ...formData, liveWeight: e.target.value })
                  }
                  required
                  data-testid="input-live-weight"
                />
              </div>
              {formData.recordType === "slaughtered" ? (
                <div className="space-y-2">
                  <Label htmlFor="hangingWeight">Hanging Weight (lbs) *</Label>
                  <Input
                    id="hangingWeight"
                    type="number"
                    step="0.01"
                    value={formData.hangingWeight}
                    onChange={(e) =>
                      setFormData({ ...formData, hangingWeight: e.target.value })
                    }
                    required
                    data-testid="input-hanging-weight"
                  />
                </div>
              ) : null}
            </div>

            {formData.recordType === "sold" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="buyer">Buyer *</Label>
                  <Input
                    id="buyer"
                    value={formData.buyer}
                    onChange={(e) =>
                      setFormData({ ...formData, buyer: e.target.value })
                    }
                    placeholder="e.g., Local Stockyards"
                    required
                    data-testid="input-buyer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricePerLb">Price per lb (optional)</Label>
                  <Input
                    id="pricePerLb"
                    type="number"
                    step="0.01"
                    value={formData.pricePerLb}
                    onChange={(e) =>
                      setFormData({ ...formData, pricePerLb: e.target.value })
                    }
                    placeholder="e.g., 2.45"
                    data-testid="input-price-per-lb"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="processor">Processor *</Label>
                <Input
                  id="processor"
                  value={formData.processor}
                  onChange={(e) =>
                    setFormData({ ...formData, processor: e.target.value })
                  }
                  placeholder="e.g., Valley Meat Processing"
                  required
                  data-testid="input-processor"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={resetDialog}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} data-testid="button-submit">
                {isEditing ? "Save Changes" : "Add Record"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
