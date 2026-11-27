'use client';

import { useCallback, useState } from 'react';
import type { ClientFilters } from '../types/client.types';

const defaultFilters: ClientFilters = {
  search: '',
  sort: 'status-name',
};

export const useClientFilters = (initialFilters?: Partial<ClientFilters>) => {
  const [filters, setFilters] = useState<ClientFilters>({
    ...defaultFilters,
    ...initialFilters,
  });

  const updateFilter = useCallback(
    <K extends keyof ClientFilters>(key: K, value: ClientFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const clearFilter = useCallback((key: keyof ClientFilters) => {
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
