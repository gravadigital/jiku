'use server';
import { apiClient } from '@/lib/axios';
import { toResult } from '../utils/docsResult';
import type {
  DocsFolder,
  DocsFolderPage,
  DocsResult,
  FolderTrail,
  FolderTrailItem,
} from '../types/docs.types';

const definedOnly = (filters: object): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')
  );

const MAX_FOLDER_PAGES = 10;
const MAX_TRAIL_LEVELS = 20;
const UNREADABLE_ANCESTOR_CODES = ['folder_not_found', 'permission_denied'];

interface FolderFilters {
  parentId?: string;
  pathPrefix?: string;
  limit?: number;
  cursor?: string;
}

export const listFolders = async (filters: FolderFilters): Promise<DocsResult<DocsFolderPage>> =>
  toResult(async () => {
    const response = await apiClient.get('/docs/folders', { params: definedOnly(filters) });
    return response.data;
  });

/** P-4: todas las carpetas visibles (páginas de 200, tope de 10 páginas). */
export const listAllFolders = async (): Promise<DocsResult<DocsFolder[]>> =>
  toResult(async () => {
    const all: DocsFolder[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_FOLDER_PAGES; page += 1) {
      const response = await apiClient.get('/docs/folders', {
        params: definedOnly({ limit: 200, cursor }),
      });
      const data: DocsFolderPage = response.data;
      all.push(...data.items);
      cursor = data.page?.cursor;
      if (!cursor) break;
    }
    return all;
  });

const fetchFolder = async (id: string): Promise<DocsFolder> => {
  const response = await apiClient.get(`/docs/folders/${id}`);
  return response.data;
};

/**
 * P-5: sube por `parentId` hasta la raíz. Un ancestro que no se puede leer corta la subida y
 * los niveles de más arriba quedan como texto (nombre sacado del `path`). La raíz no aparece.
 * Si la carpeta pedida falla, el error se devuelve (lo usa el estado *not found*).
 */
export const getFolderTrail = async (id: string): Promise<DocsResult<FolderTrail>> =>
  toResult(async () => {
    const folder = await fetchFolder(id);
    const segments = folder.path.split('/').filter(Boolean);
    const trail: FolderTrailItem[] = [{ id: folder.id, name: folder.name }];

    let parentId = folder.parentId;
    for (let level = 0; parentId && level < MAX_TRAIL_LEVELS; level += 1) {
      let parent: DocsFolder;
      try {
        parent = await fetchFolder(parentId);
      } catch (error) {
        const code = (error as { code?: string }).code ?? '';
        if (UNREADABLE_ANCESTOR_CODES.includes(code)) break;
        throw error;
      }
      if (parent.path === '/') break;
      trail.unshift({ id: parent.id, name: parent.name });
      parentId = parent.parentId;
    }

    while (trail.length < segments.length) {
      trail.unshift({ id: null, name: segments[segments.length - 1 - trail.length] });
    }

    return { folder, trail };
  });
