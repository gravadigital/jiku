'use client';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { listDocuments } from '../services/docsApi';
import { listFolders } from '../services/foldersApi';
import { unwrap } from '../utils/docsResult';
import { shouldRetryDocsQuery, withModuleInvalidation } from '../utils/moduleInvalidation';
import type { DocsDocument, DocsFolder } from '../types/docs.types';

export const FOLDER_PAGE_SIZE = 50;

interface PageParam {
  phase: 'folders' | 'documents';
  cursor?: string;
}

export interface FolderContentsPage {
  folders: DocsFolder[];
  documents: DocsDocument[];
  next?: PageParam;
}

interface UseFolderContentsOptions {
  folderId: string | undefined;
  enabled?: boolean;
}

/**
 * P-6: una sola consulta paginada que primero agota las subcarpetas y después los documentos
 * (por última actualización), para mostrarlos en una tabla con un solo "Ver más".
 */
export const useFolderContents = ({ folderId, enabled = true }: UseFolderContentsOptions) => {
  const queryClient = useQueryClient();

  const fetchDocuments = async (cursor?: string): Promise<FolderContentsPage> => {
    const page = unwrap(
      await listDocuments({ folderId, sort: '-updatedAt', limit: FOLDER_PAGE_SIZE, cursor })
    );
    return {
      folders: [],
      documents: page.items,
      next: page.page.cursor ? { phase: 'documents', cursor: page.page.cursor } : undefined,
    };
  };

  return useInfiniteQuery({
    queryKey: ['docs-folder-contents', folderId],
    queryFn: ({ pageParam }) =>
      withModuleInvalidation(queryClient, async (): Promise<FolderContentsPage> => {
        if (pageParam.phase === 'documents') return fetchDocuments(pageParam.cursor);

        const page = unwrap(
          await listFolders({
            parentId: folderId,
            limit: FOLDER_PAGE_SIZE,
            cursor: pageParam.cursor,
          })
        );
        if (page.page.cursor) {
          return {
            folders: page.items,
            documents: [],
            next: { phase: 'folders', cursor: page.page.cursor },
          };
        }
        // Sin más carpetas: si esta página vino vacía se encadena la primera de documentos para
        // no devolver una página vacía que parezca el fin.
        if (page.items.length === 0) return fetchDocuments();
        return { folders: page.items, documents: [], next: { phase: 'documents' } };
      }),
    initialPageParam: { phase: 'folders' } as PageParam,
    getNextPageParam: (last) => last.next,
    enabled: enabled && Boolean(folderId),
    retry: shouldRetryDocsQuery,
  });
};
