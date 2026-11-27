'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteProject } from '../services/projectsApi';

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};
