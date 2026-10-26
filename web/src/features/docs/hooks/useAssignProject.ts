'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateRelations } from '../services/docsApi';
import { unwrap } from '../utils/docsResult';
import { withModuleInvalidation } from '../utils/moduleInvalidation';

interface AssignProjectInput {
  id: string;
  baseVersion: number;
  projectId: number;
}

export const useAssignProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, baseVersion, projectId }: AssignProjectInput) =>
      withModuleInvalidation(queryClient, async () =>
        unwrap(await updateRelations(id, { baseVersion, add: { projects: [projectId] } }))
      ),
    retry: 0,
    // También en error: un 409 o un 504 exigen recargar la fila.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['docs', 'documents'] });
      void queryClient.invalidateQueries({ queryKey: ['docs', 'search'] });
      // Key del panel de proyecto/requisito/tarea, hasta que S-098 lo migre.
      void queryClient.invalidateQueries({ queryKey: ['docs-documents'] });
    },
  });
};
