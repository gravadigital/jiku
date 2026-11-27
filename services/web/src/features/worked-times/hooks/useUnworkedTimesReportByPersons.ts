'use client';

import { useQueries } from '@tanstack/react-query';
import { getUnworkedTimesReport } from '../services/unworkedTimesApi';
import type { UnworkedTimeReportDay } from '../types/unworked-time.types';

interface UseUnworkedTimesReportByPersonsOptions {
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly personIds: number[];
  readonly enabled?: boolean;
}

export const useUnworkedTimesReportByPersons = ({
  dateFrom,
  dateTo,
  personIds,
  enabled = true,
}: UseUnworkedTimesReportByPersonsOptions): Map<number, UnworkedTimeReportDay[]> => {
  const canFetch = enabled && !!dateFrom && !!dateTo && personIds.length > 0;

  const results = useQueries({
    queries: personIds.map((personId) => ({
      queryKey: ['unworked-times-report', dateFrom, dateTo, personId],
      queryFn: () => getUnworkedTimesReport(dateFrom!, dateTo!, personId),
      enabled: canFetch,
    })),
  });

  const map = new Map<number, UnworkedTimeReportDay[]>();
  personIds.forEach((personId, i) => {
    const data = results[i]?.data;
    if (data) {
      map.set(personId, data);
    }
  });

  return map;
};
