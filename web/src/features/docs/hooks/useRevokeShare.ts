'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { revokeShare } from '../services/sharesApi';
import { codeOf } from '../utils/docsErrors';
import { unwrap } from '../utils/docsResult';
import { withModuleInvalidation } from '../utils/moduleInvalidation';
import type { DocsSharePage } from '../types/docs.types';

// P-10: sin update optimista. La fila pasa a "revocado" después del 200.
export const useRevokeShare = (documentId: string) => {
  const queryClient = useQueryClient();
  const key = ['docs-shares', documentId];

  return useMutation({
    mutationFn: (shareId: string) =>
      withModuleInvalidation(queryClient, async () => unwrap(await revokeShare(shareId))),
    retry: 0,
    onSuccess: (data) => {
      queryClient.setQueryData<DocsSharePage>(key, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((item) =>
                item.id === data.id
                  ? { ...item, status: 'revoked', revokedAt: data.revokedAt }
                  : item
              ),
            }
          : old
      );
      queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error) => {
      if (codeOf(error) === 'share_not_found') {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
};
