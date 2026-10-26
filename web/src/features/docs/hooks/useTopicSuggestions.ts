'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listTopics } from '../services/docsApi';
import { unwrap } from '../utils/docsResult';
import { shouldRetryDocsQuery, withModuleInvalidation } from '../utils/moduleInvalidation';

interface UseTopicSuggestionsOptions {
  prefix: string;
  enabled?: boolean;
}

// El debounce de 200 ms lo hace el componente que escribe `prefix`.
export const useTopicSuggestions = ({ prefix, enabled = true }: UseTopicSuggestionsOptions) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['docs', 'topics', prefix],
    queryFn: () =>
      withModuleInvalidation(queryClient, async () => unwrap(await listTopics({ prefix }))),
    retry: shouldRetryDocsQuery,
    enabled: enabled && prefix.length >= 1,
  });
};
