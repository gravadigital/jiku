import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requirementsApi } from '../services/requirementsApi';
import { showToast } from '@/shared/components/ui/Toast/Toast';
import type { Requirement, UpdateOpusRequirementPayload } from '../types/requirement.types';

export function useUpdateRequirement(_projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requirementId,
      payload,
    }: {
      requirementId: number;
      payload: UpdateOpusRequirementPayload;
    }) => requirementsApi.updateRequirement(requirementId, payload),

    onSuccess: (updatedRequirement: Requirement) => {
      showToast('Requisito actualizado correctamente', 'success');
      queryClient.invalidateQueries({ queryKey: ['requirement', updatedRequirement.id] });
      queryClient.invalidateQueries({
        queryKey: ['requirements', updatedRequirement.projectId, 'byStatus'],
      });
    },

    onError: (_error, variables) => {
      if (variables.payload.state !== undefined) {
        showToast('Error al actualizar el estado');
      } else {
        showToast('Error al actualizar la prioridad');
      }
    },
  });
}
