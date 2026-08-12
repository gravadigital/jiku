'use client';
import { useQuery } from '@tanstack/react-query';
import { listAttachments } from '../services/attachmentsApi';
import type { Attachment, EntityType } from '../types/attachment.types';

export function useAttachments(entityType: EntityType, entityId: number) {
  return useQuery<Attachment[]>({
    queryKey: ['attachments', entityType, entityId],
    queryFn: () => listAttachments(entityType, entityId),
    staleTime: 30000,
  });
}
