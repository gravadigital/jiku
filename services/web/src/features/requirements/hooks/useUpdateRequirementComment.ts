'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateRequirementComment } from '../services/requirementsApi';
import type { UpdateCommentPayload } from '../types/requirement.types';

type UpdateRequirementCommentInput = UpdateCommentPayload & { cid: number };

export const useUpdateRequirementComment = (reqid: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cid, ...payload }: UpdateRequirementCommentInput) =>
      updateRequirementComment(reqid, cid, payload),
    onSuccess: (_data, { cid }) => {
      queryClient.invalidateQueries({ queryKey: ['requirement', reqid] });
      queryClient.invalidateQueries({ queryKey: ['attachments', 'requirement_comment', cid] });
    },
  });
};
