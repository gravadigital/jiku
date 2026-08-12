import React, { Suspense } from 'react';
import { RequirementList } from '@/features/requirements';
import { PageLayout } from '@/shared/components/layout';
import { Button, Loader } from '@/shared/components/ui';
import styles from './requirements.module.scss';
import type { RequirementFilters } from '@/features/requirements/types/requirement.types';

export const dynamic = 'force-dynamic';

export default async function Requirements({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const filters: RequirementFilters = {
    projectId: resolvedSearchParams.projectId || null,
    state: resolvedSearchParams.state || null,
    type: resolvedSearchParams.type || null,
    priority: resolvedSearchParams.priority || null,
    createdBy: resolvedSearchParams.createdBy || null,
    estimatedFinishDate: resolvedSearchParams.estimatedFinishDate || null,
    tag: resolvedSearchParams.tag || null,
    search: resolvedSearchParams.search || null,
    page: resolvedSearchParams.page ? parseInt(resolvedSearchParams.page, 10) : 1,
    limit: resolvedSearchParams.limit ? parseInt(resolvedSearchParams.limit, 10) : 15,
    sort: resolvedSearchParams.sort || null,
  };

  return (
    <PageLayout
      title="Requisitos"
      actions={[
        <div key="new-req" className={styles.newReqButton}>
          <Button label="Nuevo requisito" href="/requirements/new" />
        </div>,
      ]}
    >
      <Suspense key={JSON.stringify(filters)} fallback={<Loader label="Cargando..." />}>
        <RequirementList filters={filters} />
      </Suspense>
    </PageLayout>
  );
}
