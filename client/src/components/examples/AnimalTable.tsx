import { AnimalTable } from '../AnimalTable';

const mockAnimals = [
  {
    id: '1',
    tagNumber: 'D-2024-001',
    name: 'Bessie',
    type: 'dairy',
    sex: 'female',
    currentLocation: 'Home Farm - Pasture A',
    breedingMethod: 'ai',
  },
  {
    id: '2',
    tagNumber: 'B-2024-032',
    name: 'Thunder',
    type: 'beef',
    sex: 'male',
    currentLocation: 'South Pasture Lease',
    breedingMethod: 'live-cover',
  },
  {
    id: '3',
    tagNumber: 'D-2023-087',
    type: 'dairy',
    sex: 'female',
    currentLocation: 'Home Farm - Pasture B',
    breedingMethod: 'ai',
  },
];

export default function AnimalTableExample() {
  return (
    <div className="p-6">
      <AnimalTable
        animals={mockAnimals}
        onView={(id) => console.log('View animal:', id)}
        onEdit={(id) => console.log('Edit animal:', id)}
        onDelete={(id) => console.log('Delete animal:', id)}
      />
    </div>
  );
}
