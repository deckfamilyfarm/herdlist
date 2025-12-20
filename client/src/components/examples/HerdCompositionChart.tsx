import { HerdCompositionChart } from '../HerdCompositionChart';

export default function HerdCompositionChartExample() {
  return (
    <div className="p-6">
      <HerdCompositionChart
        data={[
          { fieldId: "field-1", field: "North", property: "Meadow Farm", dairy: 12, beef: 8 },
          { fieldId: "field-2", field: "South", property: "Meadow Farm", dairy: 6, beef: 4 },
        ]}
      />
    </div>
  );
}
