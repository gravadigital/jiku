import React, { Suspense } from 'react';
import { RequirementList } from '@/features/requirements';
import { PageLayout } from '@/shared/components/layout';
import { Button, Loader } from '@/shared/components/ui';
import type { RequirementFilters } from '@/features/requirements/types/requirement.types';

export const dynamic = 'force-dynamic';

// Default al entrar sin `state` en la URL: los cuatro estados de trabajo en curso, en el orden
// del enum `requirement_state`. `analisis`, `resuelto` y `cancelado` quedan fuera del default —
// se piden explícitamente. Ver S-041 / REQ-009 AC-1.
const DEFAULT_STATE_FILTER = 'planificacion,en_cola,desarrollo,revision';

export default async function Requirements({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const filters: RequirementFilters = {
    projectId: resolvedSearchParams.projectId || null,
    state: resolvedSearchParams.state || DEFAULT_STATE_FILTER,
    type: resolvedSearchParams.type || null,
    priority: resolvedSearchParams.priority || null,
    createdBy: resolvedSearchParams.createdBy || null,
    estimatedFinishDate: resolvedSearchParams.estimatedFinishDate || null,
    tag: resolvedSearchParams.tag || null,
    search: resolvedSearchParams.search || null,
    page: resolvedSearchParams.page ? parseInt(resolvedSearchParams.page, 10) : 1,
    limit: resolvedSearchParams.limit ? parseInt(resolvedSearchParams.limit, 10) : 15,
    sort: resolvedSearchParams.sort || null,
    // Fijo, no un filtro de usuario: la columna "Hs. Trab." es parte de la pantalla, no una
    // opción que se elige. No se lee de `searchParams` ni se escribe en la URL (S-045).
    include: 'totalMinutes',
  };

  const buttons = [
    <Button key="new-req" href="/requirements/new">
      Nuevo requisito
    </Button>,
  ];

  return (
    <PageLayout title="Requisitos" actions={buttons}>
      <Suspense key={JSON.stringify(filters)} fallback={<Loader label="Cargando..." />}>
        <RequirementList filters={filters} />
      </Suspense>
    </PageLayout>
  );
}
