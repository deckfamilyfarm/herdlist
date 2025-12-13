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

  type SortKey =
    | "tagNumber"
    | "phenotype"
    | "type"
    | "sex"
    | "dateOfBirth"
    | "currentLocation"
    | "sireTagNumber"
    | "damTagNumber"
    | "betacasein"
    | "polled";
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "dateOfBirth",
    dir: "desc",
  });

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  };

  const renderSortButton = (label: string, key: SortKey) => (
    <button
      className="flex items-center gap-1 font-medium text-sm"
      type="button"
      onClick={() => toggleSort(key)}
    >
      {label}
      <span className="text-xs text-muted-foreground">
        {sort.key === key ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );

  const sortedAnimals = useMemo(() => {
    return [...animals].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const getVal = (animal: Animal & { currentLocation?: string }) => {
        switch (sort.key) {
          case "tagNumber":
            return animal.tagNumber.toLowerCase();
          case "phenotype":
            return (animal.phenotype || "").toLowerCase();
          case "type":
            return animal.type.toLowerCase();
          case "sex":
            return (animal.sex || "").toLowerCase();
          case "currentLocation":
            return (animal.currentLocation || "").toLowerCase();
          case "sireTagNumber":
            return ((animal as any).sireTagNumber || "").toLowerCase();
          case "damTagNumber":
            return ((animal as any).damTagNumber || "").toLowerCase();
          case "betacasein":
            return (animal as any).betacasein || "";
          case "polled":
            return animal.polled ? 1 : 0;
          case "dateOfBirth":
          default:
            return animal.dateOfBirth ? new Date(animal.dateOfBirth as any).getTime() : 0;
        }
      };

      const va = getVal(a);
      const vb = getVal(b);

      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }
      return va < vb ? -1 * dir : va > vb ? 1 * dir : 0;
    });
  }, [animals, sort]);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{renderSortButton("Tag Number", "tagNumber")}</TableHead>
            <TableHead>{renderSortButton("Phenotype", "phenotype")}</TableHead>
            <TableHead>{renderSortButton("Type", "type")}</TableHead>
            <TableHead>{renderSortButton("Sex", "sex")}</TableHead>
            <TableHead data-testid="button-sort-dob">
              {renderSortButton("Date of Birth", "dateOfBirth")}
            </TableHead>
            <TableHead>{renderSortButton("Location", "currentLocation")}</TableHead>
            <TableHead>{renderSortButton("Sire", "sireTagNumber")}</TableHead>
            <TableHead>{renderSortButton("Dam", "damTagNumber")}</TableHead>
            <TableHead>{renderSortButton("A2", "betacasein")}</TableHead>
            <TableHead>{renderSortButton("Polled", "polled")}</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAnimals.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                No animals found
              </TableCell>
            </TableRow>
          ) : (
            sortedAnimals.map((animal) => (
              <TableRow key={animal.id} data-testid={`row-animal-${animal.id}`}>
                <TableCell className="font-readable-mono font-medium" data-testid={`text-tag-${animal.id}`}>
                  {animal.tagNumber}
                </TableCell>
                <TableCell>{animal.phenotype || "-"}</TableCell>
                <TableCell>
                  <Badge className={getTypeColor(animal.type)} data-testid={`badge-type-${animal.id}`}>
                    {animal.type}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize">{animal.sex}</TableCell>
                <TableCell className="font-readable-mono">{formatDate(animal.dateOfBirth)}</TableCell>
                <TableCell>{animal.currentLocation || "-"}</TableCell>
                <TableCell className="font-readable-mono">
                  {(animal as any).sireTagNumber ? (
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        const el = document.querySelector<HTMLInputElement>('[data-testid=\"input-search\"]');
                        if (el) {
                          el.value = (animal as any).sireTagNumber as string;
                          el.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                      }}
                    >
                      {(animal as any).sireTagNumber}
                    </button>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="font-readable-mono">
                  {(animal as any).damTagNumber ? (
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        const el = document.querySelector<HTMLInputElement>('[data-testid=\"input-search\"]');
                        if (el) {
                          el.value = (animal as any).damTagNumber as string;
                          el.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                      }}
                    >
                      {(animal as any).damTagNumber}
                    </button>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{(animal as any).betacasein || "Not Tested"}</TableCell>
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
