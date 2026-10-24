import { useQuery, useQueryClient } from '@tanstack/react-query';
import { docsApi } from '../services/docsApi';
import { withModuleInvalidation } from '../utils/moduleInvalidation';
import type { DocsDocument } from '../types/docs.types';

interface UseDocumentParams {
  documentId: string;
  enabled?: boolean;
}

export function useDocument({ documentId, enabled = true }: UseDocumentParams) {
  const queryClient = useQueryClient();
  return useQuery<DocsDocument>({
    queryKey: ['docs-document', documentId],
    queryFn: () => withModuleInvalidation(queryClient, () => docsApi.getById(documentId)),
    enabled: enabled && !!documentId,
  });
}
