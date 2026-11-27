import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { ReportPage } from '@/features/worked-times';
import { auth } from '@/lib/auth';
import { Loader, ViewHeader } from '@/shared/components/ui';

export const dynamic = 'force-dynamic';

export default async function WorkedTimesReport() {
  const session = await auth();

  if (session?.user?.roles?.includes('external-user')) {
    redirect('/projects');
  }

  return (
    <>
      <ViewHeader variant="list" title="Visualización de Horas" />
      <Suspense fallback={<Loader label="Cargando visualización..." />}>
        <ReportPage />
      </Suspense>
    </>
  );
}
