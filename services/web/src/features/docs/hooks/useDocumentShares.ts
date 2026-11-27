'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listShares } from '../services/sharesApi';
import { unwrap } from '../utils/docsResult';
import { shouldRetryDocsQuery, withModuleInvalidation } from '../utils/moduleInvalidation';

interface UseDocumentSharesOptions {
  documentId: string;
  enabled?: boolean;
}

// P-7: una sola página; la respuesta nunca trae token ni url (CA-31).
export const useDocumentShares = ({ documentId, enabled = true }: UseDocumentSharesOptions) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['docs-shares', documentId],
    queryFn: () =>
      withModuleInvalidation(queryClient, async () => unwrap(await listShares(documentId))),
    enabled,
    retry: shouldRetryDocsQuery,
  });
};
