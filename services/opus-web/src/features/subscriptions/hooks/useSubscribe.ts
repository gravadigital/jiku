import { useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsApi } from '../services/subscriptionsApi';

interface UseSubscribeParams {
  requirementId: number;
}

export function useSubscribe({ requirementId }: UseSubscribeParams) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => subscriptionsApi.subscribe(requirementId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirement', requirementId] });
    },
  });
}
