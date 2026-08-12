'use client';

import { useQuery } from '@tanstack/react-query';
import { getUnworkedTimesReport } from '../services/unworkedTimesApi';

interface UseUnworkedTimesReportOptions {
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly personId?: number;
  readonly enabled?: boolean;
}

export const useUnworkedTimesReport = (options: UseUnworkedTimesReportOptions = {}) => {
  const { dateFrom, dateTo, personId, enabled = true } = options;

  return useQuery({
    enabled: enabled && !!dateFrom && !!dateTo && !!personId,
    queryKey: ['unworked-times-report', dateFrom, dateTo, personId],
    queryFn: () => getUnworkedTimesReport(dateFrom!, dateTo!, personId!),
  });
};
