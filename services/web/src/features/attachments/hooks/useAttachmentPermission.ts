import { useQuery } from '@tanstack/react-query';
import { getAttachmentById } from '../services/attachmentsApi';
import type { EntityType } from '../types/attachment.types';

export function useAttachmentPermission(
  attachmentId: number,
  entityType: EntityType,
  entityId: number
) {
  return useQuery({
    queryKey: ['attachment-permission', attachmentId, entityType, entityId],
    queryFn: async () => {
      try {
        await getAttachmentById(attachmentId);
        return true;
      } catch (error: unknown) {
        const apiError = error as { status?: number };
        if (apiError?.status === 403 || apiError?.status === 404) {
          return false;
        }
        throw error;
      }
    },
    staleTime: 60000,
    retry: false,
  });
}
