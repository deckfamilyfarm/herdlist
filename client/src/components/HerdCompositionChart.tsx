import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface PropertyCount {
  property: string;
  dairy: number;
  beef: number;
}

interface HerdCompositionChartProps {
  data: PropertyCount[];
}

export function HerdCompositionChart({ data }: HerdCompositionChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Number of Animals at each Property</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="property" 
              tick={{ fill: 'hsl(var(--foreground))' }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis 
              tick={{ fill: 'hsl(var(--foreground))' }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                color: 'hsl(var(--foreground))'
              }}
            />
            <Legend />
            <Bar dataKey="dairy" fill="hsl(var(--chart-1))" name="Dairy" />
            <Bar dataKey="beef" fill="hsl(var(--chart-3))" name="Beef" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
