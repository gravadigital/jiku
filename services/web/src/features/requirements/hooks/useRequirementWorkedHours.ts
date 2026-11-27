'use client';

import { useQuery } from '@tanstack/react-query';
import { getRequirementWorkedHours } from '../services/requirementsApi';

export const useRequirementWorkedHours = (reqid: number) => {
  return useQuery({
    queryFn: () => getRequirementWorkedHours(reqid),
    queryKey: ['requirement-worked-hours', reqid],
  });
};
