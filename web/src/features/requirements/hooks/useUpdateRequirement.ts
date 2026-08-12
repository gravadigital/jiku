'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Requirement, UpdateRequirementPayload } from '../types/requirement.types';

interface UpdateRequirementParams {
  reqid: number;
  payload: UpdateRequirementPayload;
}

interface UpdateRequirementContext {
  previousRequirement: Requirement | undefined;
}

async function patchRequirement(
  reqid: number,
  payload: UpdateRequirementPayload
): Promise<Requirement> {
  const res = await fetch(`/api/requirements/${reqid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? 'Error al actualizar el requisito');
  }
  return res.json();
}

export const useUpdateRequirement = () => {
  const queryClient = useQueryClient();

  return useMutation<Requirement, Error, UpdateRequirementParams, UpdateRequirementContext>({
    mutationFn: ({ reqid, payload }: UpdateRequirementParams) => patchRequirement(reqid, payload),
    onMutate: async ({ reqid, payload }) => {
      await queryClient.cancelQueries({ queryKey: ['requirement', reqid] });
      const previousRequirement = queryClient.getQueryData<Requirement>(['requirement', reqid]);
      if (previousRequirement) {
        queryClient.setQueryData(['requirement', reqid], { ...previousRequirement, ...payload });
      }
      return { previousRequirement };
    },
    onError: (_error, { reqid }, context) => {
      if (context?.previousRequirement) {
        queryClient.setQueryData(['requirement', reqid], context.previousRequirement);
      }
    },
    onSuccess: (_data, { reqid }) => {
      queryClient.invalidateQueries({ queryKey: ['requirements'] });
      queryClient.invalidateQueries({ queryKey: ['requirement', reqid] });
    },
  });
};
