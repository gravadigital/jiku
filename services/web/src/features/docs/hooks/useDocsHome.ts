'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listDocuments } from '../services/docsApi';
import { unwrap } from '../utils/docsResult';
import { shouldRetryDocsQuery, withModuleInvalidation } from '../utils/moduleInvalidation';
import type { DocsDocument, DocsDocumentSort } from '../types/docs.types';

interface UseDocsHomeOptions {
  sort: DocsDocumentSort;
  enabled?: boolean;
}

const MINE_LIMIT = 5;
const RECENT_LIMIT = 20;

/** Inicio de `/docs`: "En mis proyectos activos" (hasta 5) y "Editados recientemente" (20). */
export const useDocsHome = ({ sort, enabled = true }: UseDocsHomeOptions) => {
  const queryClient = useQueryClient();

  const fetchPage = (filters: Parameters<typeof listDocuments>[0]) =>
    withModuleInvalidation(queryClient, async () => unwrap(await listDocuments(filters)));

  const mineFilters = { myActiveProjects: true, sort, limit: MINE_LIMIT } as const;
  const recentFilters = { sort, limit: RECENT_LIMIT } as const;

  const mine = useQuery({
    queryKey: ['docs', 'documents', mineFilters],
    queryFn: () => fetchPage(mineFilters),
    retry: shouldRetryDocsQuery,
    enabled,
  });
  const recent = useQuery({
    queryKey: ['docs', 'documents', recentFilters],
    queryFn: () => fetchPage(recentFilters),
    retry: shouldRetryDocsQuery,
    enabled,
  });

  const mineItems: DocsDocument[] = mine.data?.items ?? [];

  return {
    // Si "mis proyectos activos" falla, el grupo simplemente no se muestra.
    mine: mineItems,
    recent: recent.data?.items,
    isLoading: recent.isLoading,
    isError: recent.isError,
    error: recent.error,
  };
};
