import React, { Suspense } from 'react';
import { ObjectiveSearchFilters, ObjectivesTable } from '@/features/objectives';
import { Loader, ViewHeader } from '@/shared/components/ui';
import styles from './styles.module.scss';
import type { ObjectiveFilters } from '@/features/objectives';

export const dynamic = 'force-dynamic';

export default async function Objectives({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const filters: ObjectiveFilters = {
    area: resolvedSearchParams.area || null,
    limit: resolvedSearchParams.limit ? parseInt(resolvedSearchParams.limit, 10) : 20,
    page: resolvedSearchParams.page ? parseInt(resolvedSearchParams.page, 10) : 1,
    personId: resolvedSearchParams.personId || null,
    projectId: resolvedSearchParams.projectId || null,
    projectName: resolvedSearchParams.projectName || null,
    search: resolvedSearchParams.search || null,
    sort: resolvedSearchParams.sort || '-createdAt',
    state: resolvedSearchParams.state || 'activo',
  };

  return (
    <>
      <ViewHeader
        variant="list"
        title="Tareas"
        action={{ children: 'Nueva tarea', href: '/objectives/new' }}
      />
      <main>
        <ObjectiveSearchFilters />
        <div className={styles.containerObjectives}>
          <Suspense key={JSON.stringify(filters)} fallback={<Loader label="Cargando..." />}>
            <Suspense fallback={<Loader label="Cargando tabla..." />}>
              <ObjectivesTable filters={filters} />
            </Suspense>
          </Suspense>
        </div>
      </main>
    </>
  );
}
