import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface HerdStatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  subtitle?: string;
}

export function HerdStatCard({ title, value, icon: Icon, trend, subtitle }: HerdStatCardProps) {
  return (
    <Card data-testid={`card-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`text-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>{value}</div>
        {trend && (
          <p className={`text-xs ${trend.isPositive ? 'text-chart-4' : 'text-destructive'}`}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </p>
        )}
        {subtitle && !trend && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
