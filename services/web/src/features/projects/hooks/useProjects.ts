'use client';

import { useQuery } from '@tanstack/react-query';
import { getProjects } from '../services/projectsApi';
import type { ProjectFilters } from '../types/project.types';

interface UseProjectsOptions {
  filters?: ProjectFilters;
  enabled?: boolean;
}

export const useProjects = (options: UseProjectsOptions = {}) => {
  const { filters = {}, enabled = true } = options;

  return useQuery({
    enabled,
    queryFn: () => getProjects(filters),
    queryKey: ['projects', filters],
  });
};
