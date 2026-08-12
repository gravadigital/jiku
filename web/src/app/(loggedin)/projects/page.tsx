import React, { Suspense } from 'react';
import { ProjectListFilters, ProjectsBoard } from '@/features/projects';
import { PageLayout } from '@/shared/components/layout';
import { Button, Loader } from '@/shared/components/ui';
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

  const buttons = [<Button key="action-1" label="Nuevo proyecto" href="/projects/new" />];

  return (
    <PageLayout title="Proyectos" actions={buttons}>
      <main>
        <ProjectListFilters />
        <div className={styles.containerProjects}>
          <Suspense fallback={<Loader label="Cagando..." />}>
            <ProjectsBoard filters={filters} />
          </Suspense>
        </div>
      </main>
    </PageLayout>
  );
}
