import { useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsApi } from '../services/subscriptionsApi';

interface UseUnsubscribeParams {
  requirementId: number;
}

export function useUnsubscribe({ requirementId }: UseUnsubscribeParams) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => subscriptionsApi.unsubscribe(requirementId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirement', requirementId] });
    },
  });
}
