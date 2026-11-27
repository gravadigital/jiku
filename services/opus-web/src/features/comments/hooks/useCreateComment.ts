import { useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsApi } from '../services/commentsApi';
import type { CreateCommentPayload } from '../types/comment.types';

export function useCreateComment(requirementId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCommentPayload) => commentsApi.create(requirementId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirement', requirementId] });
    },
  });
}
