import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface FieldCount {
  property: string;
  field: string;
  fieldId: string;
  dairy: number;
  beef: number;
}

interface HerdCompositionChartProps {
  data: FieldCount[];
  title?: string;
  showPropertyLabel?: boolean;
}

export function HerdCompositionChart({
  data,
  title = "Number of Animals by Field",
  showPropertyLabel = true,
}: HerdCompositionChartProps) {
  const renderFieldTick = (props: any) => {
    const { x, y, payload } = props;
    const entry = data.find((item) => item.fieldId === payload.value);
    if (!entry) return null;

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          textAnchor="end"
          fill="hsl(var(--foreground))"
          transform="rotate(-45)"
        >
          <tspan x="0" dy="0">{entry.field}</tspan>
          {showPropertyLabel && entry.property ? (
            <tspan x="0" dy="14" fontSize="10" fill="hsl(var(--muted-foreground))">
              {entry.property}
            </tspan>
          ) : null}
        </text>
      </g>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="fieldId"
              height={90}
              interval={0}
              tick={renderFieldTick}
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
              labelFormatter={(value) => {
                const entry = data.find((item) => item.fieldId === value);
                return entry ? `${entry.field}${entry.property ? ` (${entry.property})` : ""}` : value;
              }}
            />
            <Legend verticalAlign="top" align="right" />
            <Bar dataKey="dairy" fill="hsl(var(--chart-1))" name="Dairy" stackId="total" />
            <Bar dataKey="beef" fill="hsl(var(--chart-3))" name="Beef" stackId="total" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
