import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requirementsApi } from '../services/requirementsApi';
import type { CreateRequirementPayload } from '../types/requirement.types';
import type { ApiError } from '@/lib/axios';

export function useCreateRequirement() {
  const queryClient = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof requirementsApi.create>>,
    ApiError,
    CreateRequirementPayload
  >({
    mutationFn: (payload: CreateRequirementPayload) => requirementsApi.create(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['requirements', variables.projectId],
      });
    },
  });
}
