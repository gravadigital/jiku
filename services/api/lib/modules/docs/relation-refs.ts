import { Client, Objective, Project, Requirement } from '@jiku/models';

export interface ClientRef { id: number; name: string | null }
export interface ProjectRef { id: number; name: string | null; code: string | null; clientId: number | null }
export interface TitleRef { id: number; title: string | null; projectId: number | null }

const unique = (ids: number[][]): number[] => Array.from(new Set(ids.flat()));

/** Una consulta `IN` por tipo; ninguna si no hay ids. */
export async function loadClientNames(ids: number[]): Promise<Map<number, string | null>> {
  const map = new Map<number, string | null>();
  if (ids.length === 0) return map;
  const rows = await Client.findAll({ where: { id: ids }, attributes: ['id', 'name'] });
  rows.forEach((row) => map.set(row.id, row.name ?? null));
  return map;
}

export async function loadProjects(ids: number[]): Promise<Map<number, ProjectRef>> {
  const map = new Map<number, ProjectRef>();
  if (ids.length === 0) return map;
  const rows = await Project.findAll({ where: { id: ids }, attributes: ['id', 'name', 'code', 'clientId'] });
  rows.forEach((row) => map.set(row.id, {
    id: row.id, name: row.name ?? null, code: row.code ?? null, clientId: row.clientId ?? null,
  }));
  return map;
}

async function loadTitles(model: typeof Requirement | typeof Objective, ids: number[]): Promise<Map<number, TitleRef>> {
  const map = new Map<number, TitleRef>();
  if (ids.length === 0) return map;
  const rows: any[] = await (model as any).findAll({ where: { id: ids }, attributes: ['id', 'title', 'projectId'] });
  rows.forEach((row) => map.set(row.id, { id: row.id, title: row.title ?? null, projectId: row.projectId ?? null }));
  return map;
}

const clientRefsOf = (ids: number[], names: Map<number, string | null>): ClientRef[] =>
  ids.map((id) => ({ id, name: names.has(id) ? names.get(id)! : null }));

const projectRefsOf = (ids: number[], projects: Map<number, ProjectRef>): ProjectRef[] =>
  ids.map((id) => projects.get(id) ?? { id, name: null, code: null, clientId: null });

const titleRefsOf = (ids: number[], rows: Map<number, TitleRef>): TitleRef[] =>
  ids.map((id) => rows.get(id) ?? { id, title: null, projectId: null });

/**
 * Agrega `clientRefs` y `projectRefs` (nombres desde la base) a ítems de listado o búsqueda:
 * UNA consulta por tipo para todos los ítems, orden de jiku-docs, desconocidos en `null`.
 * No muta los ítems ni toca sus campos.
 */
export async function withListRefs<T extends { clients?: number[]; projects?: number[] }>(
  items: T[]
): Promise<Array<T & { clientRefs: ClientRef[]; projectRefs: ProjectRef[] }>> {
  const clientIds = unique(items.map((item) => item.clients ?? []));
  const projectIds = unique(items.map((item) => item.projects ?? []));
  const [names, projects] = await Promise.all([loadClientNames(clientIds), loadProjects(projectIds)]);
  return items.map((item) => ({
    ...item,
    clientRefs: clientRefsOf(item.clients ?? [], names),
    projectRefs: projectRefsOf(item.projects ?? [], projects),
  }));
}

/** Detalle: lo anterior más `requirementRefs` y `taskRefs` desde `relations`. */
export async function withDocumentRefs<T extends {
  clients?: number[];
  projects?: number[];
  relations?: { requirements?: number[]; tasks?: number[] };
}>(document: T) {
  const requirementIds = unique([document.relations?.requirements ?? []]);
  const taskIds = unique([document.relations?.tasks ?? []]);
  const [[withRefs], requirements, tasks] = await Promise.all([
    withListRefs([document]),
    loadTitles(Requirement, requirementIds),
    loadTitles(Objective, taskIds),
  ]);
  return {
    ...withRefs,
    requirementRefs: titleRefsOf(document.relations?.requirements ?? [], requirements),
    taskRefs: titleRefsOf(document.relations?.tasks ?? [], tasks),
  };
}
