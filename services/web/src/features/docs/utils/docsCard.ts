import { serializeDocsSearch } from './docsSearchParams';
import type { DocsToken } from './docsSearchParams';
import type { NewDocumentInitial } from '../components/NewDocumentDialog';
import type { DocsPageInfo, DocumentsFilters } from '../types/docs.types';

export type DocsScope = { projectId: number } | { requirementId: number } | { taskId: number };

/** Lo que el "+" necesita y la card no puede deducir del `scope`. */
export interface DocsCardContext {
  clientId?: number;
  projectId?: number;
  title?: string | null;
}

export const CARD_LIMIT = 5;

export function cardFilters(scope: DocsScope): DocumentsFilters {
  // El contrato 1.3.0 acepta una lista de proyectos: la card manda uno solo.
  const base: DocumentsFilters =
    'projectId' in scope
      ? { projectId: [scope.projectId] }
      : 'requirementId' in scope
        ? { requirementId: scope.requirementId }
        : { taskId: scope.taskId };
  return { ...base, count: true, sort: '-updatedAt', limit: CARD_LIMIT };
}

const tokenOf = (
  scope: DocsScope
): Extract<DocsToken, { kind: 'proyecto' | 'requisito' | 'tarea' }> => {
  if ('projectId' in scope) return { kind: 'proyecto', id: scope.projectId };
  if ('requirementId' in scope) return { kind: 'requisito', id: scope.requirementId };
  return { kind: 'tarea', id: scope.taskId };
};

export function seeAllHref(scope: DocsScope): string {
  const token = tokenOf(scope);
  const qs = serializeDocsSearch({
    tokens: [token],
    publico: false,
    orden: 'recientes',
    pagina: 1,
    origen: token.kind,
  });
  return `/docs?${qs}`;
}

export function cardInitial(scope: DocsScope, context?: DocsCardContext): NewDocumentInitial {
  const relations = {
    ...(context?.projectId !== undefined ? { projectId: context.projectId } : {}),
    ...(context?.clientId !== undefined ? { clientId: context.clientId } : {}),
  };
  const title = context?.title ?? null;
  if ('projectId' in scope) return { projectId: scope.projectId, ...relations };
  if ('requirementId' in scope) {
    return { ...relations, requirement: { id: scope.requirementId, title } };
  }
  return { ...relations, task: { id: scope.taskId, title } };
}

/** `total` exacto; con cursor sin total, "N+"; sin cursor, `returned` es exacto. */
export function countLabel(page: DocsPageInfo): string {
  if (page.total !== undefined) return String(page.total);
  if (page.cursor) return `${page.returned}+`;
  return String(page.returned);
}
