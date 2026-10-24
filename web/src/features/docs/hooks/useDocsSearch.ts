'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { searchDocuments } from '../services/docsApi';
import { unwrap } from '../utils/docsResult';
import { shouldRetryDocsQuery, withModuleInvalidation } from '../utils/moduleInvalidation';

export const MIN_SEARCH_LENGTH = 2;

interface UseDocsSearchOptions {
  q: string;
  enabled?: boolean;
}

export const useDocsSearch = ({ q, enabled = true }: UseDocsSearchOptions) => {
  const queryClient = useQueryClient();
  const qTrim = q.trim();

  return useQuery({
    queryKey: ['docs-search', qTrim],
    queryFn: () =>
      withModuleInvalidation(queryClient, async () => unwrap(await searchDocuments({ q: qTrim }))),
    enabled: enabled && qTrim.length >= MIN_SEARCH_LENGTH,
    retry: shouldRetryDocsQuery,
  });
};
