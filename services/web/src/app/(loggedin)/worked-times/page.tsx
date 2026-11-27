import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { WorkedTimesPage } from '@/features/worked-times';
import { auth } from '@/lib/auth';
import { Loader, ViewHeader } from '@/shared/components/ui';

export const dynamic = 'force-dynamic';

export default async function WorkedTimes() {
  const session = await auth();

  if (session?.user?.roles?.includes('external-user')) {
    redirect('/projects');
  }

  return (
    <>
      <ViewHeader variant="list" title="Horas Trabajadas" />
      <Suspense fallback={<Loader label="Cargando horas trabajadas..." />}>
        <WorkedTimesPage />
      </Suspense>
    </>
  );
}
