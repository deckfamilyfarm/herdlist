import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MovementHistoryTimeline } from "@/components/MovementHistoryTimeline";
import { IndividualAnimalSelector } from "@/components/IndividualAnimalSelector";
import { MoveHorizontal } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Animal, Field, InsertMovement, Movement } from "@shared/schema";

export default function Movements() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    selectionType: '',
    fromFieldId: '',
    toFieldId: '',
    date: '',
    notes: '',
  });
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);

  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: ['/api/animals'],
  });

  const { data: fields = [] } = useQuery<Field[]>({
    queryKey: ['/api/fields'],
  });

  const { data: recentMovements = [] } = useQuery<Movement[]>({
    queryKey: ['/api/movements/recent'],
  });

  const createMovementMutation = useMutation({
    mutationFn: async (data: InsertMovement) => {
      const res = await apiRequest("POST", "/api/movements", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/movements/recent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/animals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/property-counts'] });
      toast({
        title: "Success",
        description: "Movement recorded successfully",
      });
      setFormData({
        selectionType: '',
        fromFieldId: '',
        toFieldId: '',
        date: '',
        notes: '',
      });
      setSelectedAnimalIds([]);
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
    
    let animalsToMove: string[] = [];

    // Determine which animals to move based on selection type
    if (formData.selectionType === 'individual') {
      animalsToMove = selectedAnimalIds;
    } else if (formData.selectionType === 'whole-herd') {
      // Move all animals from the source field
      if (formData.fromFieldId) {
        animalsToMove = animals
          .filter(a => a.currentFieldId === formData.fromFieldId)
          .map(a => a.id);
      }
    } else if (formData.selectionType === 'all-dairy') {
      // Move all dairy animals from source field
      if (formData.fromFieldId) {
        animalsToMove = animals
          .filter(a => a.currentFieldId === formData.fromFieldId && a.type === 'dairy')
          .map(a => a.id);
      }
    } else if (formData.selectionType === 'all-beef') {
      // Move all beef animals from source field
      if (formData.fromFieldId) {
        animalsToMove = animals
          .filter(a => a.currentFieldId === formData.fromFieldId && a.type === 'beef')
          .map(a => a.id);
      }
    }

    if (animalsToMove.length === 0) {
      toast({
        title: "No animals selected",
        description: "Please select animals to move or choose a source field with animals",
        variant: "destructive",
      });
      return;
    }
    
    animalsToMove.forEach((animalId) => {
      const movementData: InsertMovement = {
        animalId,
        fromFieldId: formData.fromFieldId || undefined,
        toFieldId: formData.toFieldId,
        movementDate: formData.date as any,
        notes: formData.notes || undefined,
      };
      createMovementMutation.mutate(movementData);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Move Animals</h1>
        <p className="text-muted-foreground">Transfer animals between fields and track movements</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MoveHorizontal className="h-5 w-5" />
                Record Movement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="selectionType">Selection Type</Label>
                  <Select value={formData.selectionType} onValueChange={(value) => setFormData({ ...formData, selectionType: value })}>
                    <SelectTrigger id="selectionType" data-testid="select-selection-type">
                      <SelectValue placeholder="Choose how to select animals" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whole-herd">Whole Herd (All Animals in From Field)</SelectItem>
                      <SelectItem value="all-dairy">All Dairy (in From Field)</SelectItem>
                      <SelectItem value="all-beef">All Beef (in From Field)</SelectItem>
                      <SelectItem value="individual">Select Individual Animals</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.selectionType === 'individual' && (
                  <IndividualAnimalSelector
                    animals={animals as Animal[]}
                    selectedIds={selectedAnimalIds}
                    onSelectionChange={setSelectedAnimalIds}
                  />
                )}

                {/* Preview animals in selected From Field */}
                {formData.fromFieldId && formData.selectionType !== 'individual' && (
                  <div className="p-4 bg-muted/50 rounded-md space-y-2">
                    <p className="text-sm font-medium">Animals in {fields.find(f => f.id === formData.fromFieldId)?.name || 'selected field'}:</p>
                    <div className="flex flex-wrap gap-2">
                      {animals
                        .filter(a => {
                          if (!a.currentFieldId || a.currentFieldId !== formData.fromFieldId) return false;
                          if (formData.selectionType === 'all-dairy') return a.type === 'dairy';
                          if (formData.selectionType === 'all-beef') return a.type === 'beef';
                          return true; // whole-herd
                        })
                        .map(a => (
                          <span key={a.id} className="px-2 py-1 bg-background border rounded text-xs">
                            {a.tagNumber} ({a.type})
                          </span>
                        ))}
                      {animals.filter(a => {
                        if (!a.currentFieldId || a.currentFieldId !== formData.fromFieldId) return false;
                        if (formData.selectionType === 'all-dairy') return a.type === 'dairy';
                        if (formData.selectionType === 'all-beef') return a.type === 'beef';
                        return true;
                      }).length === 0 && (
                        <span className="text-sm text-muted-foreground">No animals match the selected criteria</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fromField">From Field {formData.selectionType !== 'individual' ? '(Required for this selection type)' : '(Optional)'}</Label>
                    <Select value={formData.fromFieldId} onValueChange={(value) => setFormData({ ...formData, fromFieldId: value })}>
                      <SelectTrigger id="fromField" data-testid="select-from-field">
                        <SelectValue placeholder="Select current field" />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="toField">To Field</Label>
                    <Select value={formData.toFieldId} onValueChange={(value) => setFormData({ ...formData, toFieldId: value })}>
                      <SelectTrigger id="toField" data-testid="select-to-field">
                        <SelectValue placeholder="Select destination field" />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Movement Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    data-testid="input-date"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any notes about this movement..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    data-testid="textarea-notes"
                  />
                </div>

                <Button type="submit" className="w-full" data-testid="button-record-movement">
                  Record Movement
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <MovementHistoryTimeline movements={recentMovements} />
      </div>
    </div>
  );
}
