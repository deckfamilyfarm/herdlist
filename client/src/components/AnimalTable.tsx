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
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Animal, AnimalDueDateStatus, PolledStatus } from "@shared/schema";

const normalizePolledStatus = (value: any): PolledStatus => {
  if (value === "polled" || value === "horned" || value === "not tested") return value;
  if (value === true) return "polled";
  if (value === false) return "not tested";
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "polled") return "polled";
  if (normalized === "horned") return "horned";
  if (normalized === "not tested" || normalized === "not_tested" || normalized === "nottested") {
    return "not tested";
  }
  return "not tested";
};

const formatPolledStatus = (value: any) => {
  const normalized = normalizePolledStatus(value);
  return normalized === "not tested" ? "Not Tested" : normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const polledRank: Record<PolledStatus, number> = {
  polled: 0,
  horned: 1,
  "not tested": 2,
};

type TableAnimal = Animal & {
  currentLocation?: string;
  sireTagNumber?: string | null;
  damTagNumber?: string | null;
  dueDate?: string | null;
  dueDateStatus?: AnimalDueDateStatus | null;
};

interface AnimalTableProps {
  animals: TableAnimal[];
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSearchChange?: (value: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

const dateOnlyToTime = (value: string | null | undefined) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map((part) => parseInt(part, 10));
  if (!year || !month || !day) return null;
  const time = Date.UTC(year, month - 1, day);
  return Number.isNaN(time) ? null : time;
};

export function AnimalTable({
  animals,
  onView,
  onEdit: _onEdit,
  onDelete,
  onSearchChange,
  selectedIds,
  onToggleSelect,
}: AnimalTableProps) {
  const formatTypeLabel = (type: string) => {
    const normalizedType = type.trim().toLowerCase();
    return normalizedType === "ai" ? "AI" : type;
  };
  const getTypeColor = (type: string) => {
    const normalizedType = type.trim().toLowerCase();
    if (normalizedType === "dairy") return "bg-chart-1 text-primary-foreground";
    if (normalizedType === "beef") return "bg-chart-3 text-primary-foreground";
    if (normalizedType === "ai") return "bg-chart-4 text-primary-foreground";
    return "bg-muted text-foreground";
  };

  const formatDate = (value: Animal["dateOfBirth"] | string | null | undefined) => {
    if (!value) return "-";
    const str = value instanceof Date ? value.toISOString() : String(value);
    return str.includes("T") ? str.split("T")[0] : str;
  };

  const renderDueDate = (animal: TableAnimal) => {
    if (!animal.dueDate) return "-";

    return (
      <span
        className={animal.dueDateStatus === "overdue-struck" ? "line-through text-muted-foreground" : undefined}
      >
        {formatDate(animal.dueDate)}
      </span>
    );
  };

  type SortKey =
    | "tagNumber"
    | "phenotype"
    | "type"
    | "sex"
    | "dateOfBirth"
    | "dueDate"
    | "currentLocation"
    | "sireTagNumber"
    | "damTagNumber"
    | "betacasein"
    | "organic"
    | "polled"
    | "tags";
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

      if (sort.key === "dueDate") {
        const va = dateOnlyToTime(a.dueDate);
        const vb = dateOnlyToTime(b.dueDate);

        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        return (va - vb) * dir;
      }

      const getVal = (animal: TableAnimal) => {
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
            return (animal.sireTagNumber || "").toLowerCase();
          case "damTagNumber":
            return (animal.damTagNumber || "").toLowerCase();
          case "betacasein":
            return (animal as any).betacasein || "";
          case "polled":
            return polledRank[normalizePolledStatus((animal as any).polled)];
          case "organic":
            return animal.organic ? 1 : 0;
          case "tags":
            return Array.isArray((animal as any).tags) ? (animal as any).tags.join(",") : "";
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
    <div className="rounded-md border max-w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="hidden md:table-cell w-10"></TableHead>
            <TableHead>{renderSortButton("Tag Number", "tagNumber")}</TableHead>
            <TableHead>{renderSortButton("Phenotype", "phenotype")}</TableHead>
            <TableHead>{renderSortButton("Type", "type")}</TableHead>
            <TableHead>{renderSortButton("Sex", "sex")}</TableHead>
            <TableHead data-testid="button-sort-dob">
              {renderSortButton("Date of Birth", "dateOfBirth")}
            </TableHead>
            <TableHead data-testid="button-sort-due-date">
              {renderSortButton("Due Date", "dueDate")}
            </TableHead>
            <TableHead className="hidden md:table-cell">{renderSortButton("Location", "currentLocation")}</TableHead>
            <TableHead className="hidden md:table-cell">{renderSortButton("Sire", "sireTagNumber")}</TableHead>
            <TableHead className="hidden md:table-cell">{renderSortButton("Dam", "damTagNumber")}</TableHead>
            <TableHead className="hidden md:table-cell">{renderSortButton("A2", "betacasein")}</TableHead>
            <TableHead className="hidden md:table-cell">{renderSortButton("Organic", "organic")}</TableHead>
            <TableHead className="hidden md:table-cell">{renderSortButton("Horn Status", "polled")}</TableHead>
            <TableHead className="hidden md:table-cell">Tags</TableHead>
            <TableHead className="hidden md:table-cell text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAnimals.length === 0 ? (
            <TableRow>
              <TableCell colSpan={15} className="text-center text-muted-foreground">
                No animals found
              </TableCell>
            </TableRow>
          ) : (
            sortedAnimals.map((animal) => (
              <TableRow
                key={animal.id}
                data-testid={`row-animal-${animal.id}`}
                className="cursor-pointer"
                onClick={() => onView?.(animal.id)}
              >
                <TableCell className="hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    aria-label={`Select ${animal.tagNumber}`}
                    checked={selectedIds?.has(animal.id) ?? false}
                    onCheckedChange={() => onToggleSelect?.(animal.id)}
                    data-testid={`checkbox-select-${animal.id}`}
                  />
                </TableCell>
                <TableCell className="font-readable-mono font-medium" data-testid={`text-tag-${animal.id}`}>
                  {animal.tagNumber}
                </TableCell>
                <TableCell>{animal.phenotype || "-"}</TableCell>
              <TableCell>
                <Badge className={getTypeColor(animal.type)} data-testid={`badge-type-${animal.id}`}>
                  {formatTypeLabel(animal.type)}
                </Badge>
              </TableCell>
              <TableCell className="capitalize">{animal.sex}</TableCell>
              <TableCell className="font-readable-mono">{formatDate(animal.dateOfBirth)}</TableCell>
              <TableCell className="font-readable-mono">{renderDueDate(animal)}</TableCell>
              <TableCell className="hidden md:table-cell">{animal.currentLocation || "-"}</TableCell>
                <TableCell className="hidden md:table-cell font-readable-mono">
                  {(animal as any).sireTagNumber ? (
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        const value = (animal as any).sireTagNumber as string;
                        onSearchChange?.(value);
                        const el = document.querySelector<HTMLInputElement>('[data-testid="input-search"]');
                        if (el) {
                          el.value = value;
                          el.dispatchEvent(new Event("input", { bubbles: true }));
                        }
                      }}
                    >
                      {(animal as any).sireTagNumber}
                    </button>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell font-readable-mono">
                  {(animal as any).damTagNumber ? (
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        const value = (animal as any).damTagNumber as string;
                        onSearchChange?.(value);
                        const el = document.querySelector<HTMLInputElement>('[data-testid="input-search"]');
                        if (el) {
                          el.value = value;
                          el.dispatchEvent(new Event("input", { bubbles: true }));
                        }
                      }}
                    >
                      {(animal as any).damTagNumber}
                    </button>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">{(animal as any).betacasein || "Not Tested"}</TableCell>
                <TableCell className="hidden md:table-cell">{animal.organic ? "OTCO" : "Natural"}</TableCell>
                <TableCell className="hidden md:table-cell">{formatPolledStatus((animal as any).polled)}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {Array.isArray((animal as any).tags) && (animal as any).tags.length > 0
                    ? (animal as any).tags.join(", ")
                    : "-"}
                </TableCell>
                <TableCell className="hidden md:table-cell text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onView?.(animal.id);
              }}
              data-testid={`button-view-${animal.id}`}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(animal.id);
              }}
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
