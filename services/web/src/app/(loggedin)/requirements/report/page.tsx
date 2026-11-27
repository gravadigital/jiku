import React, { Suspense } from 'react';
import { RequirementsReportPage } from '@/features/requirements';
import { Loader, ViewHeader } from '@/shared/components/ui';

export const dynamic = 'force-dynamic';

export default function RequirementsReport() {
  return (
    <>
      <ViewHeader variant="list" title="Reporte de Requisitos" />
      <main>
        <Suspense fallback={<Loader label="Cargando reporte..." />}>
          <RequirementsReportPage />
        </Suspense>
      </main>
    </>
  );
}
