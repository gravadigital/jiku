'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { deleteObjective } from '@/features/objectives';
import { Button } from '@/shared/components/ui';

export function DeleteObjectiveButton({ id }: { readonly id: number }) {
  const { push } = useRouter();

  const handleClick = () => {
    deleteObjective(id);
    push('/objectives/');
  };

  return (
    <Button variant="secondary-dismiss" onClick={handleClick}>
      Eliminar
    </Button>
  );
}
