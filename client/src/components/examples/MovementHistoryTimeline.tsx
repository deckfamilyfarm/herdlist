import { MovementHistoryTimeline } from '../MovementHistoryTimeline';

const mockMovements = [
  {
    id: '1',
    movementKind: 'animal' as const,
    movementDate: '2024-10-10',
    fromFieldName: 'Pasture A',
    toFieldName: 'Pasture B',
    tagNumber: '2401',
    notes: 'Rotating to fresh grass',
  },
  {
    id: '2',
    movementKind: 'lot' as const,
    movementDate: '2024-10-08',
    fromFieldName: 'South Lease',
    toFieldName: 'North Field',
    lotName: 'Main ewe flock',
    ewesMoved: 42,
    ramsMoved: 2,
    lambsMoved: 18,
  },
  {
    id: '3',
    movementKind: 'animal' as const,
    movementDate: '2024-10-05',
    fromFieldName: 'Holding Pen',
    toFieldName: 'Pasture A',
    tagNumber: '2319',
  },
];

export default function MovementHistoryTimelineExample() {
  return (
    <div className="p-6 max-w-md">
      <MovementHistoryTimeline movements={mockMovements} />
    </div>
  );
}
