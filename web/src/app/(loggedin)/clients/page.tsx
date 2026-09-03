import React, { Suspense } from 'react';
import { ClientListFilters, ClientsBoard } from '@/features/clients';
import { PageLayout } from '@/shared/components/layout';
import { Button, Loader } from '@/shared/components/ui';
import styles from './styles.module.scss';
import type { ClientFilters } from '@/features/clients/types/client.types';

export const dynamic = 'force-dynamic';

export default async function Clients({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const filters: ClientFilters = {
    search: resolvedSearchParams.search || undefined,
    sort: resolvedSearchParams.sort || 'status-name',
    status: (resolvedSearchParams.status as ClientFilters['status']) || undefined,
  };

  const buttons = [<Button key="action-1" href="/clients/new">Nuevo actor</Button>];

  return (
    <PageLayout title="Actores" actions={buttons}>
      <main>
        <ClientListFilters />
        <div className={styles.containerClients}>
          <Suspense fallback={<Loader label="Cargando  ..." />}>
            <ClientsBoard filters={filters} />
          </Suspense>
        </div>
      </main>
    </PageLayout>
  );
}
