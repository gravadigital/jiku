import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { docsApi } from '../services/docsApi';
import { withModuleInvalidation } from '../utils/moduleInvalidation';
import type { DocsDocumentPage, DocsListScope } from '../types/docs.types';

interface UseDocumentsParams {
  projectId?: number;
  requirementId?: number;
  enabled?: boolean;
}

export function useDocuments({ projectId, requirementId, enabled = true }: UseDocumentsParams) {
  const queryClient = useQueryClient();
  const hasScope = (projectId ?? 0) > 0 || (requirementId ?? 0) > 0;
  const scope = (requirementId ? { requirementId } : { projectId }) as DocsListScope;

  return useInfiniteQuery<
    DocsDocumentPage,
    Error,
    InfiniteData<DocsDocumentPage, string | undefined>,
    unknown[],
    string | undefined
  >({
    queryKey: ['docs-documents', requirementId ? { requirementId } : { projectId }],
    queryFn: ({ pageParam }) =>
      withModuleInvalidation(queryClient, () => docsApi.list(scope, pageParam)),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.page.cursor ?? undefined,
    enabled: enabled && hasScope,
  });
}
