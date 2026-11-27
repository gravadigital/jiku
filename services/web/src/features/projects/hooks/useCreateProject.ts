'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createProject } from '../services/projectsApi';
import type { CreateProjectPayload } from '../types/project.types';

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProjectPayload) => createProject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};
