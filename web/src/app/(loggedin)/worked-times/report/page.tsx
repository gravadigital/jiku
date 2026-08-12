import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { ReportPage } from '@/features/worked-times';
import { auth } from '@/lib/auth';
import { PageLayout } from '@/shared/components/layout';
import { Loader } from '@/shared/components/ui';

export const dynamic = 'force-dynamic';

export default async function WorkedTimesReport() {
  const session = await auth();

  if (session?.user?.roles?.includes('external-user')) {
    redirect('/projects');
  }

  return (
    <PageLayout title="Visualización de Horas">
      <main>
        <Suspense fallback={<Loader label="Cargando visualización..." />}>
          <ReportPage />
        </Suspense>
      </main>
    </PageLayout>
  );
}
