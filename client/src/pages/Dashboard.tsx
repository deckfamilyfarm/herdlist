import { HerdStatCard } from "@/components/HerdStatCard";
import { MovementHistoryTimeline } from "@/components/MovementHistoryTimeline";
import { HerdCompositionChart } from "@/components/HerdCompositionChart";
import { AnimalTable } from "@/components/AnimalTable";
import { Beef, Milk, TrendingUp, Heart, Cpu, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { AnimalFormDialog } from "@/components/AnimalFormDialog";
import { useQuery } from "@tanstack/react-query";
import type { Animal, LivestockRecentMovement } from "@shared/schema";
import { useLocation } from "wouter";

interface DashboardStats {
  totalAnimals: number;
  totalLotHead: number;
  totalLivestockHead: number;
  totalLivingAnimals: number;
  activeLots: number;
  sheepCounts: {
    ewes: number;
    rams: number;
    lambs: number;
    wethers: number;
    unknown: number;
  };
  cowsReadyToBreed: number;
  animalsByType: Record<string, number>;
  animalsBySex: Record<string, number>;
}

interface FieldCount {
  property: string;
  field: string;
  fieldId: string;
  dairy: number;
  beef: number;
  ai: number;
  sheepEwes: number;
  sheepRams: number;
  sheepLambs: number;
  sheepWethers: number;
  sheepUnknown: number;
  sheepTotal: number;
}

export default function Dashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  const { data: fieldCountsData } = useQuery<FieldCount[]>({
    queryKey: ['/api/dashboard/property-counts'],
  });

  const { data: recentAnimals = [], isLoading: animalsLoading } = useQuery<Animal[]>({
    queryKey: ['/api/animals'],
  });

  const { data: recentMovements = [] } = useQuery<LivestockRecentMovement[]>({
    queryKey: ['/api/movements/recent'],
  });

  const activeRecentAnimals = recentAnimals.filter((animal) => {
    const normalizedStatus = String(animal.status ?? "active").trim().toLowerCase();
    return normalizedStatus === "" || normalizedStatus === "active";
  });
  const displayAnimals = activeRecentAnimals.slice(0, 5);
  const aiCount = stats?.animalsByType?.ai || 0;
  const individualLivingCount = Math.max(0, (stats?.totalAnimals || 0) - aiCount);
  const totalLivingAnimals =
    stats?.totalLivingAnimals ?? individualLivingCount + (stats?.totalLotHead || 0);
  const sortedFieldCounts = [...(fieldCountsData || [])].sort((a, b) => {
    if (a.property !== b.property) {
      return a.property.localeCompare(b.property);
    }
    return a.field.localeCompare(b.field);
  });

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <HerdStatCard
          title="Total Living Animals"
          value={totalLivingAnimals}
          icon={TrendingUp}
          subtitle={`${individualLivingCount} individual / ${stats?.totalLotHead || 0} lot head`}
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
          title="AI"
          value={stats?.animalsByType?.ai || 0}
          icon={Cpu}
        />
        <HerdStatCard
          title="Sheep"
          value={stats?.totalLotHead || 0}
          icon={Layers}
          subtitle={`${stats?.sheepCounts?.ewes || 0} ewes / ${stats?.sheepCounts?.lambs || 0} lambs`}
        />
        <HerdStatCard
          title="Cows Ready to Breed"
          value={stats?.cowsReadyToBreed || 0}
          icon={Heart}
          subtitle="56+ days post-calving"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <HerdCompositionChart
            data={sortedFieldCounts}
            showAi={false}
            showSheepClasses={false}
            onFieldClick={(fieldId) => setLocation(`/animals?fieldId=${encodeURIComponent(fieldId)}`)}
          />
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
