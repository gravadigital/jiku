'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import type { IObjective } from '@/shared/types';

interface TableRowProps {
  readonly objective: IObjective;
  readonly children: React.ReactNode;
}

export function TableRow(props: TableRowProps) {
  const { objective, children } = props;
  const router = useRouter();

  const handleClick = () => {
    router.push(`/objectives/${objective.id}`);
  };

  return (
    <tr onClick={handleClick} style={{ cursor: 'pointer' }}>
      {children}
    </tr>
  );
}
