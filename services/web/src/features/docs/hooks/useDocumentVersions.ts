'use client';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { listVersions } from '../services/docsApi';
import { unwrap } from '../utils/docsResult';
import { shouldRetryDocsQuery, withModuleInvalidation } from '../utils/moduleInvalidation';

interface UseDocumentVersionsOptions {
  id: string;
  enabled?: boolean;
}

/** Historial del documento, la versión más nueva primero (orden fijo de la api). */
export const useDocumentVersions = ({ id, enabled = true }: UseDocumentVersionsOptions) => {
  const queryClient = useQueryClient();

  return useInfiniteQuery({
    queryKey: ['docs', 'versions', id],
    queryFn: ({ pageParam }) =>
      withModuleInvalidation(queryClient, async () =>
        unwrap(await listVersions(id, pageParam ? { cursor: pageParam } : {}))
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.page.cursor ?? undefined,
    retry: shouldRetryDocsQuery,
    enabled,
  });
};
