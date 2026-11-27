'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSuggestedRelations } from '../services/docsApi';
import { unwrap } from '../utils/docsResult';
import { shouldRetryDocsQuery, withModuleInvalidation } from '../utils/moduleInvalidation';

interface UseSuggestedRelationsOptions {
  id: string;
  enabled?: boolean;
}

export const useSuggestedRelations = ({ id, enabled = true }: UseSuggestedRelationsOptions) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['docs', 'suggested-relations', id],
    queryFn: () =>
      withModuleInvalidation(queryClient, async () => unwrap(await getSuggestedRelations(id))),
    // Se pide una consulta por fila visible (REQ-021, Riesgos): 5 min evita repetirla al
    // paginar, ordenar o volver a la pantalla.
    staleTime: 5 * 60_000,
    retry: shouldRetryDocsQuery,
    enabled,
  });
};
