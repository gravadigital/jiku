'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDocument } from '../services/docsApi';
import { withModuleInvalidation } from '../utils/moduleInvalidation';

interface UseDocumentOptions {
  id: string;
  enabled?: boolean;
}

const NO_RETRY_CODES = ['module_unavailable', 'document_not_found'];

const shouldRetry = (count: number, error: unknown): boolean => {
  const { code, status } = (error ?? {}) as { code?: string; status?: number };
  if (status === 404 || (code && NO_RETRY_CODES.includes(code))) return false;
  return count < 1;
};

export const useDocument = ({ id, enabled = true }: UseDocumentOptions) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['docs-document', id],
    queryFn: () => withModuleInvalidation(queryClient, () => getDocument(id)),
    enabled,
    retry: shouldRetry,
  });
};
