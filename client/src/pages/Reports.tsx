import { ReportFilters } from "@/components/ReportFilters";
import { HerdCompositionChart } from "@/components/HerdCompositionChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";

interface DashboardStats {
  totalAnimals: number;
  cowsReadyToBreed: number;
  animalsByType: Record<string, number>;
  animalsBySex: Record<string, number>;
}

interface PropertyCount {
  property: string;
  dairy: number;
  beef: number;
}

export default function Reports() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  const { data: propertyCountsData = [], isLoading: propertyCountsLoading } = useQuery<PropertyCount[]>({
    queryKey: ['/api/dashboard/property-counts'],
  });

  const dairyCount = stats?.animalsByType?.dairy || 0;
  const beefCount = stats?.animalsByType?.beef || 0;
  const totalAnimals = stats?.totalAnimals || 0;
  const dairyPercentage = totalAnimals > 0 ? Math.round((dairyCount / totalAnimals) * 100) : 0;
  const beefPercentage = totalAnimals > 0 ? Math.round((beefCount / totalAnimals) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Reports</h1>
        <p className="text-muted-foreground">Generate herd composition and historical reports</p>
      </div>

      <ReportFilters />

      <HerdCompositionChart data={propertyCountsData} />

      <Card>
        <CardHeader>
          <CardTitle>Herd Summary Report</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Loading report data...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Dairy Cows</TableCell>
                  <TableCell className="text-right font-mono">{dairyCount}</TableCell>
                  <TableCell className="text-right">{dairyPercentage}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Beef Cattle</TableCell>
                  <TableCell className="text-right font-mono">{beefCount}</TableCell>
                  <TableCell className="text-right">{beefPercentage}%</TableCell>
                </TableRow>
                <TableRow className="font-bold">
                  <TableCell>Total Animals</TableCell>
                  <TableCell className="text-right font-mono">{totalAnimals}</TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
