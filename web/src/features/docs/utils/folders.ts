import type { DocsFolder, RootFolders } from '../types/docs.types';

/**
 * P-4: arma la vista de la raíz de `/docs`. Si la carpeta raíz (`path: "/"`) es visible, es la
 * vista; si no, las carpetas visibles de más arriba (sin padre o con el padre fuera de las
 * visibles), ordenadas por nombre.
 */
export function resolveRoot(all: readonly DocsFolder[]): RootFolders {
  const root = all.find((folder) => folder.path === '/') ?? null;
  const ids = new Set(all.map((folder) => folder.id));
  const tops = all
    .filter(
      (folder) =>
        folder.path !== '/' &&
        (folder.parentId === null || !ids.has(folder.parentId) || folder.parentId === root?.id)
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return { root, tops };
}
