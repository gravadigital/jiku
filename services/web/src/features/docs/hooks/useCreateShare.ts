'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createShare } from '../services/sharesApi';
import { codeOf } from '../utils/docsErrors';
import { unwrap } from '../utils/docsResult';
import { withModuleInvalidation } from '../utils/moduleInvalidation';
import type { CreateShareInput } from '../types/docs.types';

// Sin reintento (ADR-002, P-4): un alta sin `id` no es idempotente. `gcTime: 0` (P-3): el caché de
// mutaciones no retiene la `url` del 201 una vez que nadie observa la mutación.
export const useCreateShare = (documentId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateShareInput) =>
      withModuleInvalidation(queryClient, async () => unwrap(await createShare(documentId, input))),
    gcTime: 0,
    retry: 0,
    onError: (error) => {
      if (codeOf(error) === 'sharing_not_configured') {
        queryClient.invalidateQueries({ queryKey: ['modules'] });
      }
    },
    // Éxito o error: un 504 pudo haber creado el link y debe aparecer en la lista (P-4).
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['docs-shares', documentId] }),
  });
};
