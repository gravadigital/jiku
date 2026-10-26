'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { searchDocuments } from '../services/docsApi';
import { unwrap } from '../utils/docsResult';
import { shouldRetryDocsQuery, withModuleInvalidation } from '../utils/moduleInvalidation';
import type { SearchDocumentsParams } from '../types/docs.types';

interface UseDocsTextSearchOptions {
  /** Ya trae `limit: 50` (ver `toSearchQuery`). */
  query: SearchDocumentsParams;
  enabled?: boolean;
}

export const useDocsTextSearch = ({ query, enabled = true }: UseDocsTextSearchOptions) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['docs', 'search', query],
    queryFn: () =>
      withModuleInvalidation(queryClient, async () => unwrap(await searchDocuments(query))),
    retry: shouldRetryDocsQuery,
    enabled: enabled && query.q.trim().length >= 2,
  });
};
