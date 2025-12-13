import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Animal } from "@shared/schema";

interface AnimalTableProps {
  animals: (Animal & { currentLocation?: string })[];
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function AnimalTable({ animals, onView, onEdit, onDelete }: AnimalTableProps) {
  const getTypeColor = (type: string) => {
    return type === "dairy" ? "bg-chart-1 text-primary-foreground" : "bg-chart-3 text-primary-foreground";
  };

  const formatDate = (value: Animal["dateOfBirth"]) => {
    if (!value) return "-";
    const str = value instanceof Date ? value.toISOString() : String(value);
    return str.includes("T") ? str.split("T")[0] : str;
  };

  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedAnimals = useMemo(() => {
    return [...animals].sort((a, b) => {
      const dateA = a.dateOfBirth ? new Date(a.dateOfBirth as any).getTime() : 0;
      const dateB = b.dateOfBirth ? new Date(b.dateOfBirth as any).getTime() : 0;
      return sortDir === "asc" ? dateA - dateB : dateB - dateA;
    });
  }, [animals, sortDir]);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tag Number</TableHead>
            <TableHead>Phenotype</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Sex</TableHead>
            <TableHead>
              <button
                className="flex items-center gap-1 font-medium text-sm"
                onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
                type="button"
                data-testid="button-sort-dob"
              >
                Date of Birth
                <span className="text-xs text-muted-foreground">{sortDir === "asc" ? "↑" : "↓"}</span>
              </button>
            </TableHead>
            <TableHead>Location</TableHead>
            <TableHead>A2A2</TableHead>
            <TableHead>Polled</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAnimals.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
                No animals found
              </TableCell>
            </TableRow>
          ) : (
            sortedAnimals.map((animal) => (
              <TableRow key={animal.id} data-testid={`row-animal-${animal.id}`}>
                <TableCell className="font-mono font-medium" data-testid={`text-tag-${animal.id}`}>
                  {animal.tagNumber}
                </TableCell>
                <TableCell>{animal.phenotype || "-"}</TableCell>
                <TableCell>
                  <Badge className={getTypeColor(animal.type)} data-testid={`badge-type-${animal.id}`}>
                    {animal.type}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize">{animal.sex}</TableCell>
                <TableCell>{formatDate(animal.dateOfBirth)}</TableCell>
                <TableCell>{animal.currentLocation || "-"}</TableCell>
                <TableCell>{animal.a2a2 ? "Yes" : "No"}</TableCell>
                <TableCell>{animal.polled ? "Yes" : "No"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView?.(animal.id)}
                      data-testid={`button-view-${animal.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit?.(animal.id)}
                      data-testid={`button-edit-${animal.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete?.(animal.id)}
                      data-testid={`button-delete-${animal.id}`}
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
  );
}
