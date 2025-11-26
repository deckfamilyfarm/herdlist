import { MovementHistoryTimeline } from '../MovementHistoryTimeline';

const mockMovements = [
  {
    id: '1',
    date: '2024-10-10',
    fromField: 'Pasture A',
    toField: 'Pasture B',
    animalCount: 12,
    notes: 'Rotating to fresh grass',
  },
  {
    id: '2',
    date: '2024-10-08',
    fromField: 'South Lease',
    toField: 'North Field',
    animalCount: 8,
  },
  {
    id: '3',
    date: '2024-10-05',
    fromField: 'Holding Pen',
    toField: 'Pasture A',
    animalCount: 15,
  },
];

export default function MovementHistoryTimelineExample() {
  return (
    <div className="p-6 max-w-md">
      <MovementHistoryTimeline movements={mockMovements} />
    </div>
  );
}
