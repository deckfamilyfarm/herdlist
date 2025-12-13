import { IndividualAnimalSelector } from '../IndividualAnimalSelector';
import { useState } from 'react';

const mockAnimals = [
  { id: '1', tagNumber: 'D-2024-001', phenotype: 'Bessie', type: 'dairy', sex: 'female', currentLocation: 'Pasture A' },
  { id: '2', tagNumber: 'B-2024-032', phenotype: 'Thunder', type: 'beef', sex: 'male', currentLocation: 'South Lease' },
  { id: '3', tagNumber: 'D-2023-087', phenotype: 'Quiet heifer', type: 'dairy', sex: 'female', currentLocation: 'Pasture B' },
  { id: '4', tagNumber: 'B-2024-045', phenotype: 'Duke', type: 'beef', sex: 'male', currentLocation: 'North Field' },
];

export default function IndividualAnimalSelectorExample() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <div className="p-6 max-w-md">
      <IndividualAnimalSelector
        animals={mockAnimals}
        selectedIds={selectedIds}
        onSelectionChange={(ids) => {
          setSelectedIds(ids);
          console.log('Selected:', ids);
        }}
      />
    </div>
  );
}
