'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDocument } from '../services/docsApi';
import { unwrap } from '../utils/docsResult';
import { withModuleInvalidation } from '../utils/moduleInvalidation';
import type { CreateDocumentPayload } from '../types/docs.types';

// Sin reintento (ADR-002): un alta sin `id` no es idempotente.
export const useCreateDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateDocumentPayload) =>
      withModuleInvalidation(queryClient, async () => unwrap(await createDocument(payload))),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['docs-folder-contents', variables.folderId] });
      queryClient.invalidateQueries({ queryKey: ['docs-documents'] });
    },
  });
};
