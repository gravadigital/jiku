'use client';

import { useQuery } from '@tanstack/react-query';
import { getReportByProject } from '../services/workedTimesApi';

interface UseReportByProjectOptions {
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly enabled?: boolean;
}

export const useReportByProject = (options: UseReportByProjectOptions = {}) => {
  const { dateFrom, dateTo, enabled = true } = options;
  return useQuery({
    queryKey: ['report-by-project', { dateFrom, dateTo }],
    queryFn: () => getReportByProject(dateFrom!, dateTo!),
    enabled: enabled && !!dateFrom && !!dateTo,
  });
};
