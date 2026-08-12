'use client';

import { useCallback, useState } from 'react';
import type { ProjectFilters } from '../types/project.types';

const defaultFilters: ProjectFilters = {
  search: '',
  state: 'all',
  type: 'all',
};

export const useProjectFilters = (initialFilters?: Partial<ProjectFilters>) => {
  const [filters, setFilters] = useState<ProjectFilters>({
    ...defaultFilters,
    ...initialFilters,
  });

  const updateFilter = useCallback(
    <K extends keyof ProjectFilters>(key: K, value: ProjectFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const clearFilter = useCallback((key: keyof ProjectFilters) => {
    setFilters((prev) => ({ ...prev, [key]: defaultFilters[key] }));
  }, []);

  return {
    clearFilter,
    filters,
    resetFilters,
    setFilters,
    updateFilter,
  };
};
