'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAttachment } from '../services/attachmentsApi';

export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: number) => deleteAttachment(attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
    },
  });
}
