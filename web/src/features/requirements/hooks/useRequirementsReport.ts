'use client';

import { useQuery } from '@tanstack/react-query';
import { getRequirementsReport } from '../services/requirementsApi';
import type { RequirementReportFilters } from '../types/requirement.types';

export const useRequirementsReport = (filters: RequirementReportFilters = {}) => {
  return useQuery({
    queryFn: () => getRequirementsReport(filters),
    queryKey: ['requirements-report', filters],
  });
};
