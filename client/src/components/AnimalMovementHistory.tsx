import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Animal, Field } from "@shared/schema";
import type { HistoryEntry } from "@shared/movementHistory";

type HistoryRow = HistoryEntry & { id: string; animalId: string };
const snapshot = (row: HistoryRow): HistoryEntry => ({
  fromFieldId: row.fromFieldId || null, toFieldId: row.toFieldId,
  movementDate: row.movementDate, notes: row.notes ?? null,
});

export function AnimalMovementHistory({ animal, fields }: { animal: Animal; fields: Field[] }) {
  const historyKey = ["/api/movements/animal", animal.id];
  const { data: history = [], isLoading, isError, refetch } = useQuery<HistoryRow[]>({
    queryKey: historyKey, refetchOnWindowFocus: true,
  });
  const [editor, setEditor] = useState<{ original: HistoryRow | null; date: string; from: string; to: string; notes: string } | null>(null);
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      if (!editor) return;
      const entry: HistoryEntry = {
        fromFieldId: editor.from || null, toFieldId: editor.to, notes: editor.notes || null,
        // Retain the timestamp when only a location or note is being corrected.
        movementDate: editor.original?.movementDate.slice(0, 10) === editor.date
          ? editor.original.movementDate : `${editor.date}T00:00:00.000Z`,
      };
      if (editor.original) {
        await apiRequest("PUT", `/api/movements/${encodeURIComponent(editor.original.id)}`, {
          entry, expected: snapshot(editor.original),
        });
      } else {
        await apiRequest("POST", `/api/animals/${encodeURIComponent(animal.id)}/movement-history`, entry);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: historyKey });
      queryClient.invalidateQueries({ queryKey: ["/api/movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movements/recent"] });
      setEditor(null);
      setError("");
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const fieldName = (id: string | null) => !id ? "Unassigned" : fields.find((field) => field.id === id)?.name || `Deleted location (${id})`;
  const fieldOptions = (selected: string) => <>
    {selected && !fields.some((field) => field.id === selected) && <option value={selected}>{fieldName(selected)}</option>}
    {fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}
  </>;

  return <Card data-testid="animal-movement-history">
    <CardHeader><CardTitle>Movement history: {animal.tagNumber}</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Correct the actual dates and locations below, or add a missing historical movement.
        These changes leave the animal's current location unchanged. After saving, return to Dairy and refresh the grazing report.
      </p>
      <div className="flex flex-wrap gap-3 items-center">
        <Button type="button" disabled={mutation.isPending} onClick={() => {
          setError(""); setEditor({ original: null, date: "", from: "", to: "", notes: "" });
        }}>Add missing historical movement</Button>
        <a className="underline text-sm" href={`/animals?animalId=${encodeURIComponent(animal.id)}&edit=1`}>Edit current location, status or birth date</a>
      </div>
      {isLoading && <p role="status">Loading movement history…</p>}
      {isError && <div role="alert"><p>Movement history could not be loaded.</p><Button onClick={() => refetch()}>Refresh history</Button></div>}
      {error && <p role="alert" className="text-destructive break-words">{error}</p>}
      {editor && <form aria-label="Correct movement history" className="space-y-3 border rounded-md p-4" onSubmit={(event) => {
        event.preventDefault(); setError(""); mutation.mutate();
      }}>
        <h3 className="font-semibold">{editor.original ? "Correct historical movement" : "Add missing historical movement"}</h3>
        <fieldset disabled={mutation.isPending} className="space-y-3">
          <div><Label htmlFor="history-date">Actual movement date</Label>
            <Input id="history-date" type="date" required value={editor.date} onChange={(event) => setEditor({ ...editor, date: event.target.value })} /></div>
          <div><Label htmlFor="history-from">From location</Label>
            <select id="history-from" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={editor.from} onChange={(event) => setEditor({ ...editor, from: event.target.value })}>
              <option value="">Unassigned / not known</option>{fieldOptions(editor.from)}
            </select></div>
          <div><Label htmlFor="history-to">To location</Label>
            <select id="history-to" required className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={editor.to} onChange={(event) => setEditor({ ...editor, to: event.target.value })}>
              <option value="">Choose actual destination</option>{fieldOptions(editor.to)}
            </select></div>
          <div><Label htmlFor="history-notes">Notes / source of correction</Label>
            <Textarea id="history-notes" maxLength={1000} value={editor.notes} onChange={(event) => setEditor({ ...editor, notes: event.target.value })} /></div>
          <div className="flex gap-3"><Button type="submit">{mutation.isPending ? "Saving…" : "Save history"}</Button>
            <Button type="button" variant="outline" onClick={() => { setEditor(null); setError(""); }}>Cancel</Button></div>
        </fieldset>
      </form>}
      {!isLoading && !isError && !history.length && <p>No recorded movements for this animal.</p>}
      <ol className="space-y-3">{history.map((move) => <li key={move.id} className="border rounded-md p-3 space-y-2 text-sm break-words">
        <p className="font-semibold">{move.movementDate.slice(0, 10)}: {fieldName(move.fromFieldId)} → {fieldName(move.toFieldId)}</p>
        {move.notes && <p>{move.notes}</p>}
        <Button type="button" variant="outline" size="sm" disabled={mutation.isPending} onClick={() => {
          setError(""); setEditor({ original: move, date: move.movementDate.slice(0, 10), from: move.fromFieldId || "", to: move.toFieldId, notes: move.notes || "" });
        }}>Correct this movement</Button>
      </li>)}</ol>
    </CardContent>
  </Card>;
}
