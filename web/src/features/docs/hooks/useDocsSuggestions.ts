'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDocsSuggestions } from '../services/docsApi';
import { unwrap } from '../utils/docsResult';
import { shouldRetryDocsQuery, withModuleInvalidation } from '../utils/moduleInvalidation';

interface UseDocsSuggestionsOptions {
  q: string;
  clientId?: number;
  enabled?: boolean;
}

// El debounce de 200 ms lo hace el componente que escribe `q`.
export const useDocsSuggestions = ({ q, clientId, enabled = true }: UseDocsSuggestionsOptions) => {
  const queryClient = useQueryClient();
  const text = q.trim();

  return useQuery({
    queryKey: ['docs', 'suggestions', text, clientId],
    queryFn: () =>
      withModuleInvalidation(queryClient, async () =>
        unwrap(await getDocsSuggestions({ q: text, ...(clientId ? { clientId } : {}) }))
      ),
    retry: shouldRetryDocsQuery,
    enabled: enabled && text.length >= 1,
  });
};
