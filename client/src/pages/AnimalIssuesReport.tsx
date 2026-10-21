import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AnimalDetailDialog } from "@/components/AnimalDetailDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { Animal, AnimalListItem } from "@shared/schema";
import type { AnimalIssue, AnimalIssueCode } from "@shared/animalIssues";

const issueLabels: Record<AnimalIssueCode, string> = {
  missingBirthDate: "Missing date of birth",
  unknownLocation: "Unknown location",
  currentLocationMismatch: "Current location mismatch",
  unknownOwner: "Unknown owner",
  missingOwnershipHistory: "Dated ownership needed",
};

export default function AnimalIssuesReport() {
  const [, navigate] = useLocation();
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  const { data: issues = [], isLoading, error } = useQuery<AnimalIssue[]>({
    queryKey: ["/api/reports/animal-issues"], staleTime: 0,
    refetchOnMount: "always", refetchOnWindowFocus: true,
  });
  const { data: animals = [] } = useQuery<AnimalListItem[]>({ queryKey: ["/api/animals"] });
  const selectedAnimal = animals.find((animal) => animal.id === selectedAnimalId);
  const issueGroups = Array.from(issues.reduce((groups, issue) => {
    const group = groups.get(issue.animalId) || [];
    group.push(issue);
    groups.set(issue.animalId, group);
    return groups;
  }, new Map<string, AnimalIssue[]>()).values());

  return <section className="space-y-4">
    <h2 className="text-xl font-semibold">Memorized Reports</h2>
    <Card>
      <CardHeader><CardTitle>Animal Issues</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Active dairy and beef animals with a missing birth date, location, or a current field that disagrees with their latest movement. After a birth date is recorded, missing dated ownership is also shown. AI records are excluded. Select an animal to review its records.</p>
        {isLoading ? <p>Loading animal issues…</p> : error ?
          <p role="alert">Could not load animal issues: {String(error)}</p> : <>
          <p className="text-sm"><strong>{issueGroups.length}</strong> animals · <strong>{issues.length}</strong> issues</p>
          {issues.length === 0 ? <p className="text-sm text-muted-foreground">No animal issues found.</p> :
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead>Animal</TableHead><TableHead>Type</TableHead><TableHead>Issues</TableHead>
                <TableHead>Current field</TableHead><TableHead>Owner</TableHead>
              </TableRow></TableHeader>
              <TableBody>{issueGroups.map((group) => { const issue = group[0]; return <TableRow key={issue.animalId}>
                <TableCell><button type="button" className="cursor-pointer font-medium text-primary underline underline-offset-4 hover:no-underline"
                  onClick={() => setSelectedAnimalId(issue.animalId)}>{issue.tagNumber}</button></TableCell>
                <TableCell>{issue.type}</TableCell>
                <TableCell className="max-w-lg"><ul className="space-y-2">{group.map((item) =>
                  <li key={item.code}><span className="font-medium">{issueLabels[item.code]}:</span> {item.detail}</li>
                )}</ul></TableCell>
                <TableCell>{issue.currentFieldName || "—"}</TableCell>
                <TableCell>{issue.ownerName || "—"}</TableCell>
              </TableRow>; })}</TableBody>
            </Table></div>}
        </>}
      </CardContent>
    </Card>
    {selectedAnimal && <AnimalDetailDialog key={selectedAnimal.id} open={!!selectedAnimalId}
      onOpenChange={(open) => { if (!open) setSelectedAnimalId(null); }}
      animal={selectedAnimal as Animal}
      onEdit={() => navigate(`/animals?animalId=${selectedAnimal.id}&edit=1`)} />}
  </section>;
}
