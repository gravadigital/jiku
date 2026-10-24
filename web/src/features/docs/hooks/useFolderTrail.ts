'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFolderTrail } from '../services/foldersApi';
import { unwrap } from '../utils/docsResult';
import { shouldRetryDocsQuery, withModuleInvalidation } from '../utils/moduleInvalidation';

interface UseFolderTrailOptions {
  folderId: string | undefined;
  enabled?: boolean;
}

export const useFolderTrail = ({ folderId, enabled = true }: UseFolderTrailOptions) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['docs-folder-trail', folderId],
    queryFn: () =>
      withModuleInvalidation(queryClient, async () => unwrap(await getFolderTrail(folderId!))),
    enabled: enabled && Boolean(folderId),
    retry: shouldRetryDocsQuery,
  });
};
