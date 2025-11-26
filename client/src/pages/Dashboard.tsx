import { HerdStatCard } from "@/components/HerdStatCard";
import { MovementHistoryTimeline } from "@/components/MovementHistoryTimeline";
import { HerdCompositionChart } from "@/components/HerdCompositionChart";
import { AnimalTable } from "@/components/AnimalTable";
import { Beef, Milk, TrendingUp, Activity, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { AnimalFormDialog } from "@/components/AnimalFormDialog";
import { useQuery } from "@tanstack/react-query";
import type { Animal } from "@shared/schema";

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

interface Movement {
  id: string;
  animalId: string;
  fromFieldId: string | null;
  toFieldId: string;
  movementDate: string;
  notes?: string | null;
}

export default function Dashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  const { data: propertyCountsData } = useQuery<PropertyCount[]>({
    queryKey: ['/api/dashboard/property-counts'],
  });

  const { data: recentAnimals = [], isLoading: animalsLoading } = useQuery<Animal[]>({
    queryKey: ['/api/animals'],
  });

  const { data: recentMovements = [] } = useQuery<Movement[]>({
    queryKey: ['/api/movements/recent'],
  });

  const displayAnimals = recentAnimals.slice(0, 5);

  if (statsLoading || animalsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your herd operations</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-add-animal">
          <Plus className="h-4 w-4 mr-2" />
          Add Animal
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <HerdStatCard
          title="Total Animals"
          value={stats?.totalAnimals || 0}
          icon={TrendingUp}
        />
        <HerdStatCard
          title="Dairy Cows"
          value={stats?.animalsByType?.dairy || 0}
          icon={Milk}
        />
        <HerdStatCard
          title="Beef Cattle"
          value={stats?.animalsByType?.beef || 0}
          icon={Beef}
        />
        <HerdStatCard
          title="Cows Ready to Breed"
          value={stats?.cowsReadyToBreed || 0}
          icon={Heart}
          subtitle="56+ days post-calving"
        />
        <HerdStatCard
          title="Active Breeding"
          value={stats?.animalsBySex?.female || 0}
          icon={Activity}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <HerdCompositionChart data={propertyCountsData || []} />
        </div>
        <MovementHistoryTimeline movements={recentMovements} />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Recent Animals</h2>
        <AnimalTable
          animals={displayAnimals}
          onView={(id) => console.log('View animal:', id)}
          onEdit={(id) => console.log('Edit animal:', id)}
          onDelete={(id) => console.log('Delete animal:', id)}
        />
      </div>

      <AnimalFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={(data) => console.log('New animal:', data)}
      />
    </div>
  );
}
