import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { WeeklyAllocationTable } from '@/features/time-allocation';
import { auth } from '@/lib/auth';
import { PageLayout } from '@/shared/components/layout';
import { Loader } from '@/shared/components/ui';

export const dynamic = 'force-dynamic';

export default async function TimeAllocation() {
  const session = await auth();

  if (session?.user?.roles?.includes('external-user')) {
    redirect('/projects');
  }

  return (
    <PageLayout title="Asignación de Tiempo">
      <main>
        <Suspense fallback={<Loader label="Cargando asignaciones..." />}>
          <WeeklyAllocationTable />
        </Suspense>
      </main>
    </PageLayout>
  );
}
