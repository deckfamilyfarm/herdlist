import { HerdStatCard } from '../HerdStatCard';
import { Beef, Milk, TrendingUp } from 'lucide-react';

export default function HerdStatCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
      <HerdStatCard
        title="Total Animals"
        value={233}
        icon={TrendingUp}
        trend={{ value: "+12 this month", isPositive: true }}
      />
      <HerdStatCard
        title="Dairy Cows"
        value={105}
        icon={Milk}
      />
      <HerdStatCard
        title="Beef Cattle"
        value={128}
        icon={Beef}
      />
    </div>
  );
}
