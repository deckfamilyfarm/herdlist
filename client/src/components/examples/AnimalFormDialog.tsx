import { AnimalFormDialog } from '../AnimalFormDialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function AnimalFormDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Open Animal Form</Button>
      <AnimalFormDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={(data) => console.log('Submitted:', data)}
      />
    </div>
  );
}
