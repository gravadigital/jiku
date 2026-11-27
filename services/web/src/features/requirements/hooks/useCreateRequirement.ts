'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRequirement } from '../services/requirementsApi';
import type { CreateRequirementPayload } from '../types/requirement.types';

export const useCreateRequirement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateRequirementPayload) => createRequirement(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements'] });
    },
  });
};
