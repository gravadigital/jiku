'use client';

import { useQuery } from '@tanstack/react-query';
import { getReportByPerson } from '../services/workedTimesApi';

interface UseReportByPersonOptions {
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly enabled?: boolean;
}

export const useReportByPerson = (options: UseReportByPersonOptions = {}) => {
  const { dateFrom, dateTo, enabled = true } = options;
  return useQuery({
    queryKey: ['report-by-person', { dateFrom, dateTo }],
    queryFn: () => getReportByPerson(dateFrom!, dateTo!),
    enabled: enabled && !!dateFrom && !!dateTo,
  });
};
