'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateDocument } from '../services/docsApi';
import { unwrap } from '../utils/docsResult';
import { withModuleInvalidation } from '../utils/moduleInvalidation';
import type { UpdateDocumentPayload } from '../types/docs.types';

// Sin reintento (ADR-002, CA-30): un 504 significa "pudo haberse aplicado".
export const useSaveDocument = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateDocumentPayload) =>
      withModuleInvalidation(queryClient, async () => unwrap(await updateDocument(id, payload))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs-document', id] });
      queryClient.invalidateQueries({ queryKey: ['docs-documents'] });
      // Por prefijo: un guardado cambia `updatedAt` en la carpeta del documento.
      queryClient.invalidateQueries({ queryKey: ['docs-folder-contents'] });
    },
  });
};
