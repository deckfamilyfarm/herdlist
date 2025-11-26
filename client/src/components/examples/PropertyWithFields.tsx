import { PropertyWithFields } from '../PropertyWithFields';

const mockProperty = {
  id: '1',
  name: 'South Pasture Lease',
  isLeased: 'yes' as const,
  leaseStartDate: '2024-01-01',
  leaseEndDate: '2024-12-31',
  leaseholder: 'Johnson Family Farm',
  fields: [
    { id: 'f1', name: 'East Field', capacity: 60, currentCount: 58 },
    { id: 'f2', name: 'West Field', capacity: 45, currentCount: 35 },
    { id: 'f3', name: 'South Pasture', capacity: 30, currentCount: 22 },
  ],
};

export default function PropertyWithFieldsExample() {
  return (
    <div className="p-6">
      <PropertyWithFields
        property={mockProperty}
        onAddField={(id) => console.log('Add field to:', id)}
        onEditProperty={(id) => console.log('Edit property:', id)}
        onEditField={(id) => console.log('Edit field:', id)}
      />
    </div>
  );
}
