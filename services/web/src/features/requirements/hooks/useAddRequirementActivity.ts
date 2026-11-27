'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addRequirementActivity } from '../services/requirementsApi';
import type { AddActivityPayload } from '../types/requirement.types';

export const useAddRequirementActivity = (reqid: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddActivityPayload) => addRequirementActivity(reqid, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirement', reqid] });
    },
  });
};
