import { PropertyCard } from '../PropertyCard';

const mockProperty = {
  id: '1',
  name: 'South Pasture Lease',
  isLeased: 'yes' as const,
  leaseStartDate: '2024-01-01',
  leaseEndDate: '2024-12-31',
  leaseholder: 'Johnson Family Farm',
  fieldCount: 3,
  animalCount: 58,
};

export default function PropertyCardExample() {
  return (
    <div className="p-6 max-w-md">
      <PropertyCard
        property={mockProperty}
        onClick={(id) => console.log('Property clicked:', id)}
      />
    </div>
  );
}
