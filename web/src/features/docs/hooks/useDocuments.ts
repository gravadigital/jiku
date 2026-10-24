'use client';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { listDocuments } from '../services/docsApi';
import { unwrap } from '../utils/docsResult';
import { withModuleInvalidation } from '../utils/moduleInvalidation';
import type { DocumentsFilters } from '../types/docs.types';

interface UseDocumentsOptions {
  filters: Omit<DocumentsFilters, 'limit' | 'cursor'>;
  enabled?: boolean;
}

export const PANEL_PAGE_SIZE = 10;

export const useDocuments = ({ filters, enabled = true }: UseDocumentsOptions) => {
  const queryClient = useQueryClient();

  return useInfiniteQuery({
    queryKey: ['docs-documents', filters],
    queryFn: ({ pageParam }) =>
      withModuleInvalidation(queryClient, async () =>
        unwrap(
          await listDocuments({
            ...filters,
            limit: PANEL_PAGE_SIZE,
            ...(pageParam ? { cursor: pageParam } : {}),
          })
        )
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.page.cursor ?? undefined,
    enabled,
  });
};
