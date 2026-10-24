'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDocument } from '../services/docsApi';
import { unwrap } from '../utils/docsResult';
import { shouldRetryDocsQuery, withModuleInvalidation } from '../utils/moduleInvalidation';

interface UseDocumentOptions {
  id: string;
  enabled?: boolean;
  /** Para revisar si el bloqueo venció sin recargar (S-082). */
  refetchInterval?: number | false;
}

export const useDocument = ({
  id,
  enabled = true,
  refetchInterval = false,
}: UseDocumentOptions) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['docs-document', id],
    queryFn: () => withModuleInvalidation(queryClient, async () => unwrap(await getDocument(id))),
    enabled,
    retry: shouldRetryDocsQuery,
    refetchInterval,
  });
};
