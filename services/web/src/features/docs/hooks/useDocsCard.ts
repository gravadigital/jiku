'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listDocuments } from '../services/docsApi';
import { unwrap } from '../utils/docsResult';
import { shouldRetryDocsQuery, withModuleInvalidation } from '../utils/moduleInvalidation';
import type { DocumentsFilters } from '../types/docs.types';

interface UseDocsCardOptions {
  /** Ya trae `limit` y `count: true` (ver `cardFilters`). */
  filters: DocumentsFilters;
  enabled?: boolean;
}

/** Una sola página (sin cursor). Cuelga de `['docs', 'documents']`: las mutaciones la refrescan. */
export const useDocsCard = ({ filters, enabled = true }: UseDocsCardOptions) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['docs', 'documents', 'card', filters],
    queryFn: () =>
      withModuleInvalidation(queryClient, async () => unwrap(await listDocuments(filters))),
    retry: shouldRetryDocsQuery,
    enabled,
  });
};
