'use client';

import { useCallback, useState } from 'react';
import type { ObjectiveFilters } from '../types/objective.types';

const defaultFilters: ObjectiveFilters = {
  area: 'all',
  personId: null,
  projectId: null,
  search: '',
  state: 'all',
};

export const useObjectiveFilters = (initialFilters?: Partial<ObjectiveFilters>) => {
  const [filters, setFilters] = useState<ObjectiveFilters>({
    ...defaultFilters,
    ...initialFilters,
  });

  const updateFilter = useCallback(
    <K extends keyof ObjectiveFilters>(key: K, value: ObjectiveFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const clearFilter = useCallback((key: keyof ObjectiveFilters) => {
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
