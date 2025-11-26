import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import type { Animal } from "@shared/schema";

interface IndividualAnimalSelectorProps {
  animals: (Animal & { currentLocation?: string })[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function IndividualAnimalSelector({
  animals,
  selectedIds,
  onSelectionChange,
}: IndividualAnimalSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAnimals = animals.filter(
    (animal) =>
      animal.tagNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      animal.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredAnimals.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(filteredAnimals.map((animal) => animal.id));
    }
  };

  return (
    <Card data-testid="card-animal-selector">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Select Animals</CardTitle>
          <Badge variant="secondary" data-testid="badge-selected-count">
            {selectedIds.length} selected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by tag or name..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-animals"
          />
        </div>

        <div className="flex items-center gap-2 pb-2 border-b">
          <Checkbox
            id="select-all"
            checked={selectedIds.length === filteredAnimals.length && filteredAnimals.length > 0}
            onCheckedChange={handleSelectAll}
            data-testid="checkbox-select-all"
          />
          <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
            Select All ({filteredAnimals.length})
          </label>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-2">
          {filteredAnimals.map((animal) => (
            <div
              key={animal.id}
              className="flex items-center gap-3 p-2 rounded-md hover-elevate"
              data-testid={`animal-item-${animal.id}`}
            >
              <Checkbox
                id={animal.id}
                checked={selectedIds.includes(animal.id)}
                onCheckedChange={() => handleToggle(animal.id)}
                data-testid={`checkbox-animal-${animal.id}`}
              />
              <label htmlFor={animal.id} className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{animal.tagNumber}</span>
                  {animal.name && (
                    <span className="text-sm text-muted-foreground">({animal.name})</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    className={`text-xs ${animal.type === 'dairy' ? 'bg-chart-1' : 'bg-chart-3'}`}
                  >
                    {animal.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{animal.currentLocation}</span>
                </div>
              </label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
