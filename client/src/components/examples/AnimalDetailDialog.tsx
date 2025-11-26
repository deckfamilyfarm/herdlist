import { AnimalDetailDialog } from '../AnimalDetailDialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const mockAnimal = {
  id: '1',
  tagNumber: 'D-2024-001',
  name: 'Bessie',
  type: 'dairy',
  sex: 'female',
  dateOfBirth: '2022-03-15',
  breedingMethod: 'ai',
  currentLocation: 'Home Farm - Pasture A',
  sire: 'B-2020-034',
  dam: 'D-2019-087',
};

export default function AnimalDetailDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>View Animal Details</Button>
      <AnimalDetailDialog open={open} onOpenChange={setOpen} animal={mockAnimal} />
    </div>
  );
}
