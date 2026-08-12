'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateProject } from '../services/projectsApi';
import type { UpdateProjectPayload } from '../types/project.types';

interface UpdateProjectParams {
  id: number;
  payload: UpdateProjectPayload;
}

export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: UpdateProjectParams) => updateProject(id, payload),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'project' && String(query.queryKey[1]) === String(id),
      });
    },
  });
};
