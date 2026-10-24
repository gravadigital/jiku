'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadDocAttachment } from '../services/docsClientApi';
import { withModuleInvalidation } from '../utils/moduleInvalidation';

export const useUploadDocAttachment = (documentId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) =>
      withModuleInvalidation(queryClient, () => uploadDocAttachment(documentId, file)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs-document', documentId] });
    },
  });
};
