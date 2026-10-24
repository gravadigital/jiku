'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listAllFolders } from '../services/foldersApi';
import { unwrap } from '../utils/docsResult';
import { resolveRoot } from '../utils/folders';
import { shouldRetryDocsQuery, withModuleInvalidation } from '../utils/moduleInvalidation';

interface UseRootFoldersOptions {
  enabled?: boolean;
}

export const useRootFolders = ({ enabled = true }: UseRootFoldersOptions = {}) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['docs-root-folders'],
    queryFn: () => withModuleInvalidation(queryClient, async () => unwrap(await listAllFolders())),
    // P-4: la cache guarda la lista cruda; `resolveRoot` arma la vista sin repetir el pedido.
    select: resolveRoot,
    enabled,
    retry: shouldRetryDocsQuery,
  });
};
