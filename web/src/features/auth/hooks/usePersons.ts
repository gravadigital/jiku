'use client';

import { useQuery } from '@tanstack/react-query';
import { getPersons } from '../services/personsApi';

interface UsePersonsOptions {
  enabled?: boolean;
}

export const usePersons = (options: UsePersonsOptions = {}) => {
  const { enabled = true } = options;

  return useQuery({
    enabled,
    queryFn: getPersons,
    queryKey: ['persons'],
  });
};
