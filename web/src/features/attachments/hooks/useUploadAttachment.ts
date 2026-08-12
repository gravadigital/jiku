'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadAttachments } from '../services/attachmentsClientApi';
import type { EntityType } from '../types/attachment.types';

interface UploadPayload {
  entityType: EntityType;
  // null para requirement_draft anclado al usuario (sin proyecto seleccionado).
  entityId: number | null;
  files: File[];
}

export function useUploadAttachment(options?: {
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: ({ entityType, entityId, files }: UploadPayload) =>
      uploadAttachments(entityType, entityId, files, setProgress),
    onSuccess: (_, { entityType, entityId }) => {
      setProgress(0);
      queryClient.invalidateQueries({ queryKey: ['attachments', entityType, entityId] });
      options?.onSuccess?.();
    },
    onError: (err) => {
      setProgress(0);
      options?.onError?.(err as Error);
    },
  });

  return { ...mutation, progress };
}
