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

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tag Number</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Sex</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Breeding Method</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {animals.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No animals found
              </TableCell>
            </TableRow>
          ) : (
            animals.map((animal) => (
              <TableRow key={animal.id} data-testid={`row-animal-${animal.id}`}>
                <TableCell className="font-mono font-medium" data-testid={`text-tag-${animal.id}`}>
                  {animal.tagNumber}
                </TableCell>
                <TableCell>{animal.name || "-"}</TableCell>
                <TableCell>
                  <Badge className={getTypeColor(animal.type)} data-testid={`badge-type-${animal.id}`}>
                    {animal.type}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize">{animal.sex}</TableCell>
                <TableCell>{animal.currentLocation || "-"}</TableCell>
                <TableCell>{animal.breedingMethod || "-"}</TableCell>
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
