import React, { Suspense } from 'react';
import { RequirementsReportPage } from '@/features/requirements';
import { PageLayout } from '@/shared/components/layout';
import { Loader } from '@/shared/components/ui';

export const dynamic = 'force-dynamic';

export default function RequirementsReport() {
  return (
    <PageLayout title="Reporte de Requisitos">
      <main>
        <Suspense fallback={<Loader label="Cargando reporte..." />}>
          <RequirementsReportPage />
        </Suspense>
      </main>
    </PageLayout>
  );
}
