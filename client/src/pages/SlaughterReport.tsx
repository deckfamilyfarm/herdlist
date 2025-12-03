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
import { useState } from "react";
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

export default function SlaughterReport() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    animalId: "",
    slaughterDate: "",
    liveWeight: "",
    hangingWeight: "",
    processor: "",
  });

  const { data: slaughterRecords = [], isLoading } = useQuery<SlaughterRecord[]>({
    queryKey: ["/api/slaughter-records"],
  });

  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
  });

  const createSlaughterRecordMutation = useMutation({
    mutationFn: async (data: InsertSlaughterRecord) => {
      const res = await apiRequest("POST", "/api/slaughter-records", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slaughter-records"] });
      toast({
        title: "Success",
        description: "Slaughter record added successfully",
      });
      setDialogOpen(false);
      setFormData({
        animalId: "",
        slaughterDate: "",
        liveWeight: "",
        hangingWeight: "",
        processor: "",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const submitData: InsertSlaughterRecord = {
      animalId: formData.animalId,
      slaughterDate: formData.slaughterDate,
      // backend computes ageMonths; we omit it
      liveWeight: formData.liveWeight || undefined,
      hangingWeight: formData.hangingWeight || undefined,
      processor: formData.processor || undefined,
    };

    createSlaughterRecordMutation.mutate(submitData);
  };

  // Averages still use ageMonths returned from backend
  const avgAge =
    slaughterRecords.length > 0
      ? Math.round(
          slaughterRecords.reduce((sum, r) => sum + (r.ageMonths || 0), 0) /
            slaughterRecords.length,
        )
      : 0;

  const recordsWithWeights = slaughterRecords.filter(
    (r) => r.liveWeight && r.hangingWeight,
  );

  const avgYield =
    recordsWithWeights.length > 0
      ? Math.round(
          recordsWithWeights.reduce((sum, r) => {
            const yield_ =
              (parseFloat(r.hangingWeight!) / parseFloat(r.liveWeight!)) * 100;
            return sum + yield_;
          }, 0) / recordsWithWeights.length,
        )
      : 0;

  const totalHangingWeight = slaughterRecords
    .reduce((sum, r) => sum + parseFloat(r.hangingWeight || "0"), 0)
    .toFixed(0);

  const getAnimalLabel = (animalId: string) => {
    const animal = animals.find((a) => a.id === animalId);
    if (!animal) return animalId; // fallback to UUID if somehow missing
    return `${animal.tagNumber}${
      animal.name ? ` (${animal.name})` : ""
    }`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Slaughter Report
          </h1>
          <p className="text-muted-foreground">
            Track processor results and yields
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-export">
            <FileDown className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setDialogOpen(true)} data-testid="button-add-record">
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
            <CardTitle className="text-sm font-medium">Avg Age (Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-age">
              {avgAge}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg Yield %</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-yield">
              {avgYield}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Total Hanging Weight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-weight">
              {totalHangingWeight} lbs
            </div>
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
            <CardTitle>Slaughter Records</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Animal</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Age (Mo)</TableHead>
                  <TableHead>Live Weight</TableHead>
                  <TableHead>Hanging Weight</TableHead>
                  <TableHead>Yield %</TableHead>
                  <TableHead>Processor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slaughterRecords.map((record) => {
                  const yieldPercent =
                    record.liveWeight && record.hangingWeight
                      ? (
                          (parseFloat(record.hangingWeight) /
                            parseFloat(record.liveWeight)) *
                          100
                        ).toFixed(1)
                      : "-";

                  const animalLabel = getAnimalLabel(record.animalId);

                  return (
                    <TableRow
                      key={record.id}
                      data-testid={`row-slaughter-${record.id}`}
                    >
                      <TableCell className="font-mono font-medium">
                        {animalLabel}
                      </TableCell>
                      <TableCell>{record.slaughterDate}</TableCell>
                      <TableCell className="font-mono">
                        {record.ageMonths || "-"}
                      </TableCell>
                      <TableCell className="font-mono">
                        {record.liveWeight ? `${record.liveWeight} lbs` : "-"}
                      </TableCell>
                      <TableCell className="font-mono">
                        {record.hangingWeight
                          ? `${record.hangingWeight} lbs`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {yieldPercent}
                          {yieldPercent !== "-" ? "%" : ""}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.processor || "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-add-slaughter">
          <DialogHeader>
            <DialogTitle>Add Slaughter Record</DialogTitle>
            <DialogDescription>
              Enter the processor results and animal details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="animal">Animal *</Label>
              <Select
                value={formData.animalId}
                onValueChange={(value) =>
                  setFormData({ ...formData, animalId: value })
                }
              >
                <SelectTrigger id="animal" data-testid="select-animal">
                  <SelectValue placeholder="Select animal" />
                </SelectTrigger>
                <SelectContent>
                  {animals.map((animal) => (
                    <SelectItem key={animal.id} value={animal.id}>
                      {animal.tagNumber}
                      {animal.name ? ` (${animal.name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slaughterDate">Slaughter Date *</Label>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="liveWeight">Live Weight (lbs) *</Label>
                <Input
                  id="liveWeight"
                  type="number"
                  value={formData.liveWeight}
                  onChange={(e) =>
                    setFormData({ ...formData, liveWeight: e.target.value })
                  }
                  required
                  data-testid="input-live-weight"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hangingWeight">Hanging Weight (lbs) *</Label>
                <Input
                  id="hangingWeight"
                  type="number"
                  value={formData.hangingWeight}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hangingWeight: e.target.value,
                    })
                  }
                  required
                  data-testid="input-hanging-weight"
                />
              </div>
            </div>

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

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" data-testid="button-submit">
                Add Record
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

