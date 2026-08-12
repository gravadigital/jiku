import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { WorkedTimesPage } from '@/features/worked-times';
import { auth } from '@/lib/auth';
import { PageLayout } from '@/shared/components/layout';
import { Loader } from '@/shared/components/ui';

export const dynamic = 'force-dynamic';

export default async function WorkedTimes() {
  const session = await auth();

  if (session?.user?.roles?.includes('external-user')) {
    redirect('/projects');
  }

  return (
    <PageLayout title="Horas Trabajadas">
      <main>
        <Suspense fallback={<Loader label="Cargando horas trabajadas..." />}>
          <WorkedTimesPage />
        </Suspense>
      </main>
    </PageLayout>
  );
}
