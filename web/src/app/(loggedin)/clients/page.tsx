import React, { Suspense } from 'react';
import { ClientListFilters, ClientsBoard } from '@/features/clients';
import { Loader, ViewHeader } from '@/shared/components/ui';
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

  return (
    <>
      <ViewHeader
        variant="list"
        title="Actores"
        action={{ children: 'Nuevo actor', href: '/clients/new' }}
      />
      <main>
        <ClientListFilters />
        <div className={styles.containerClients}>
          <Suspense fallback={<Loader label="Cargando  ..." />}>
            <ClientsBoard filters={filters} />
          </Suspense>
        </div>
      </main>
    </>
  );
}
