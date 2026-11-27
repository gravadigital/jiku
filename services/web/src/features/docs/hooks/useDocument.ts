'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDocument } from '../services/docsApi';
import { unwrap } from '../utils/docsResult';
import { shouldRetryDocsQuery, withModuleInvalidation } from '../utils/moduleInvalidation';

interface UseDocumentOptions {
  id: string;
  /** Versión histórica a leer; sin ella, la vigente. */
  version?: number;
  enabled?: boolean;
  /** Para revisar si el bloqueo venció sin recargar (S-082). */
  refetchInterval?: number | false;
}

export const useDocument = ({
  id,
  version,
  enabled = true,
  refetchInterval = false,
}: UseDocumentOptions) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: version === undefined ? ['docs-document', id] : ['docs-document', id, { version }],
    queryFn: () =>
      withModuleInvalidation(queryClient, async () => unwrap(await getDocument(id, version))),
    enabled,
    retry: shouldRetryDocsQuery,
    refetchInterval,
  });
};
