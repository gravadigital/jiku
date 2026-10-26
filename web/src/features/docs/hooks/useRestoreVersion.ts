'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restoreVersion } from '../services/docsApi';
import { unwrap } from '../utils/docsResult';
import { withModuleInvalidation } from '../utils/moduleInvalidation';
import type { RestoreVersionPayload } from '../types/docs.types';

export const useRestoreVersion = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RestoreVersionPayload) =>
      withModuleInvalidation(queryClient, async () => unwrap(await restoreVersion(id, payload))),
    retry: 0,
    // También en error: tras un 504 la restauración pudo aplicarse; un 409 exige recargar.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['docs-document', id] });
      void queryClient.invalidateQueries({ queryKey: ['docs', 'versions', id] });
      void queryClient.invalidateQueries({ queryKey: ['docs', 'documents'] });
      void queryClient.invalidateQueries({ queryKey: ['docs', 'search'] });
      void queryClient.invalidateQueries({ queryKey: ['docs-documents'] });
    },
  });
};
