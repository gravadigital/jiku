import type { DocsOrder } from '../../utils/docsSearchParams';
import type { DocsRowModel } from '../DocumentRow';

export const TEXT_PAGE_SIZE = 20;

/** "Relevancia" es el orden del servicio; "Más recientes", `updatedAt` descendente. Luego, página de 20. */
export function pageOfTextResults(
  items: readonly DocsRowModel[],
  orden: DocsOrder,
  pagina: number
): DocsRowModel[] {
  const sorted =
    orden === 'recientes'
      ? [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      : items;
  return sorted.slice((pagina - 1) * TEXT_PAGE_SIZE, pagina * TEXT_PAGE_SIZE);
}
