'use client';

import { useEffect } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { listDocuments } from '../services/docsApi';
import { unwrap } from '../utils/docsResult';
import { shouldRetryDocsQuery, withModuleInvalidation } from '../utils/moduleInvalidation';
import type { DocsDocument, DocumentsFilters } from '../types/docs.types';

interface UseDocsListOptions {
  /** Ya trae `limit` y `count: true` (ver `toListFilters`). */
  filters: DocumentsFilters;
  /** Página visible (1 en base). */
  pagina: number;
  enabled?: boolean;
}

/**
 * Listado con cursor. `pages[]` es la pila de cursores en memoria: la página visible es
 * `pages[pagina - 1]`; si la URL pide una que todavía no se cargó, se encadenan los cursores.
 */
export const useDocsList = ({ filters, pagina, enabled = true }: UseDocsListOptions) => {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ['docs', 'documents', filters],
    queryFn: ({ pageParam }) =>
      withModuleInvalidation(queryClient, async () =>
        unwrap(await listDocuments({ ...filters, ...(pageParam ? { cursor: pageParam } : {}) }))
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.page.cursor ?? undefined,
    retry: shouldRetryDocsQuery,
    enabled,
  });

  const { data, hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;
  const loaded = data?.pages.length ?? 0;

  useEffect(() => {
    if (
      enabled &&
      !isError &&
      loaded > 0 &&
      loaded < pagina &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage();
    }
  }, [enabled, isError, loaded, pagina, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const pageItems: DocsDocument[] | undefined = data?.pages[pagina - 1]?.items;

  return {
    pageItems,
    total: data?.pages[0]?.page.total,
    lastAvailablePage: data && !hasNextPage ? loaded : null,
    isLoading: query.isLoading || (loaded > 0 && loaded < pagina && !isError && hasNextPage),
    isError,
    error: query.error,
  };
};
