import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { WeeklyAllocationTable } from '@/features/time-allocation';
import { auth } from '@/lib/auth';
import { Loader, ViewHeader } from '@/shared/components/ui';

export const dynamic = 'force-dynamic';

export default async function TimeAllocation() {
  const session = await auth();

  if (session?.user?.roles?.includes('external-user')) {
    redirect('/projects');
  }

  return (
    <>
      <ViewHeader variant="list" title="Asignación de Tiempo" />
      <Suspense fallback={<Loader label="Cargando asignaciones..." />}>
        <WeeklyAllocationTable />
      </Suspense>
    </>
  );
}
