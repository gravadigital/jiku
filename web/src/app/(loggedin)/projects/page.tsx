import React, { Suspense } from 'react';
import { ProjectListFilters, ProjectsBoard } from '@/features/projects';
import { Loader, ViewHeader } from '@/shared/components/ui';
import styles from './styles.module.scss';
import type { ProjectFilters } from '@/shared/types';

export const dynamic = 'force-dynamic';

export default async function Projects({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const filters: ProjectFilters = {
    search: resolvedSearchParams.search || undefined,
    sort: resolvedSearchParams.sort || '-initDate',
    state: resolvedSearchParams.state || 'activo',
    type: resolvedSearchParams.type || undefined,
  };

  return (
    <>
      <ViewHeader
        variant="list"
        title="Proyectos"
        action={{ children: 'Nuevo proyecto', href: '/projects/new' }}
      />
      <main>
        <ProjectListFilters />
        <div className={styles.containerProjects}>
          <Suspense fallback={<Loader label="Cargando..." />}>
            <ProjectsBoard filters={filters} />
          </Suspense>
        </div>
      </main>
    </>
  );
}
