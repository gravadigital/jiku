import type { DocumentsFilters, SearchDocumentsParams } from '../types/docs.types';

export type DocsToken =
  | { kind: 'proyecto'; id: number }
  | { kind: 'cliente'; id: number }
  | { kind: 'tema'; value: string }
  | { kind: 'persona'; sub: string }
  | { kind: 'requisito'; id: number }
  | { kind: 'tarea'; id: number }
  | { kind: 'texto'; value: string }
  | { kind: 'sinProyecto' }
  | { kind: 'sinCliente' }
  | { kind: 'sinTema' };

export type DocsOrder = 'recientes' | 'az' | 'relevancia';
export type DocsOrigin = 'proyecto' | 'requisito' | 'tarea';

export interface DocsSearchState {
  /** En el orden de la URL (Backspace quita el último). */
  tokens: DocsToken[];
  publico: boolean;
  /** Ya normalizado al modo. */
  orden: DocsOrder;
  pagina: number;
  origen: DocsOrigin | null;
}

export const SIN_TOKENS: readonly DocsToken[] = [
  { kind: 'sinProyecto' },
  { kind: 'sinCliente' },
  { kind: 'sinTema' },
];

export const LIST_PAGE_SIZE = 20;
export const TEXT_SEARCH_LIMIT = 50;

const MAX_BY_KIND: Partial<Record<DocsToken['kind'], number>> = {
  proyecto: 20,
  cliente: 20,
  tema: 20,
  persona: 10,
  requisito: 1,
  tarea: 1,
};
const MAX_TEMA = 500;
const MAX_PERSONA = 200;
const MIN_TEXT = 2;
const ORIGINS: readonly DocsOrigin[] = ['proyecto', 'requisito', 'tarea'];

// Un "Sin X" no convive con los tokens X: la combinación sería vacía por construcción.
const EXCLUDES: Partial<Record<DocsToken['kind'], DocsToken['kind']>> = {
  sinProyecto: 'proyecto',
  proyecto: 'sinProyecto',
  sinCliente: 'cliente',
  cliente: 'sinCliente',
  sinTema: 'tema',
  tema: 'sinTema',
};

export const tokenKey = (token: DocsToken): string => {
  switch (token.kind) {
    case 'proyecto':
    case 'cliente':
    case 'requisito':
    case 'tarea':
      return `${token.kind}:${token.id}`;
    case 'tema':
    case 'texto':
      return `${token.kind}:${token.value}`;
    case 'persona':
      return `persona:${token.sub}`;
    default:
      return token.kind;
  }
};

const positiveInt = (raw: string): number | null => {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
};

const insertToken = (tokens: DocsToken[], token: DocsToken): DocsToken[] => {
  const key = tokenKey(token);
  if (tokens.some((t) => tokenKey(t) === key)) return tokens;
  const excluded = EXCLUDES[token.kind];
  const kept = excluded ? tokens.filter((t) => t.kind !== excluded) : tokens;
  const max = MAX_BY_KIND[token.kind];
  if (max !== undefined && kept.filter((t) => t.kind === token.kind).length >= max) return kept;
  return [...kept, token];
};

const modeOfTokens = (tokens: DocsToken[], publico: boolean): 'inicio' | 'listado' | 'texto' => {
  if (tokens.some((t) => t.kind === 'texto')) return 'texto';
  return tokens.length === 0 && !publico ? 'inicio' : 'listado';
};

const defaultOrder = (mode: 'inicio' | 'listado' | 'texto'): DocsOrder =>
  mode === 'texto' ? 'relevancia' : 'recientes';

const normalizeOrder = (orden: string | null, mode: 'inicio' | 'listado' | 'texto'): DocsOrder => {
  const allowed: DocsOrder[] = mode === 'texto' ? ['relevancia', 'recientes'] : ['recientes', 'az'];
  return allowed.find((o) => o === orden) ?? defaultOrder(mode);
};

const tokenOf = (key: string, value: string): DocsToken | null => {
  switch (key) {
    case 'proyecto':
    case 'cliente':
    case 'requisito':
    case 'tarea': {
      const id = positiveInt(value);
      return id === null ? null : ({ kind: key, id } as DocsToken);
    }
    case 'tema':
      return value && value.length <= MAX_TEMA ? { kind: 'tema', value } : null;
    case 'persona':
      return value && value.length <= MAX_PERSONA ? { kind: 'persona', sub: value } : null;
    case 'q': {
      const text = value.trim();
      return text.length >= MIN_TEXT ? { kind: 'texto', value: text } : null;
    }
    case 'sinProyecto':
    case 'sinCliente':
    case 'sinTema':
      return value === '1' ? ({ kind: key } as DocsToken) : null;
    default:
      return null;
  }
};

export function parseDocsSearch(params: URLSearchParams): DocsSearchState {
  let tokens: DocsToken[] = [];
  let publico = false;
  let rawOrden: string | null = null;
  let pagina = 1;
  let origen: DocsOrigin | null = null;

  for (const [key, value] of params) {
    if (key === 'publico') {
      if (value === '1') publico = true;
    } else if (key === 'orden') {
      rawOrden = value;
    } else if (key === 'pagina') {
      pagina = positiveInt(value) ?? 1;
    } else if (key === 'origen') {
      origen = ORIGINS.find((o) => o === value) ?? origen;
    } else {
      const token = tokenOf(key, value);
      if (token) tokens = insertToken(tokens, token);
    }
  }

  return {
    tokens,
    publico,
    orden: normalizeOrder(rawOrden, modeOfTokens(tokens, publico)),
    pagina,
    origen,
  };
}

const paramOf = (token: DocsToken): [string, string] => {
  switch (token.kind) {
    case 'proyecto':
    case 'cliente':
    case 'requisito':
    case 'tarea':
      return [token.kind, String(token.id)];
    case 'tema':
      return ['tema', token.value];
    case 'persona':
      return ['persona', token.sub];
    case 'texto':
      return ['q', token.value];
    default:
      return [token.kind, '1'];
  }
};

/** Sin `?`; `''` si no queda nada. Solo escribe params conocidos (nada de URL de vuelta). */
export function serializeDocsSearch(state: DocsSearchState): string {
  const out = new URLSearchParams();
  for (const token of state.tokens) out.append(...paramOf(token));
  if (state.publico) out.append('publico', '1');
  const mode = modeOfTokens(state.tokens, state.publico);
  if (state.orden !== defaultOrder(mode)) out.append('orden', state.orden);
  if (state.pagina > 1) out.append('pagina', String(state.pagina));
  if (state.origen) out.append('origen', state.origen);
  return out.toString();
}

// Cualquier cambio de filtro vuelve a la página 1; sin el token de la entidad de origen, el origen se va.
const withChange = (state: DocsSearchState, patch: Partial<DocsSearchState>): DocsSearchState => {
  const next = { ...state, ...patch, pagina: 1 };
  const mode = modeOfTokens(next.tokens, next.publico);
  const origen =
    next.origen && next.tokens.some((t) => t.kind === next.origen) ? next.origen : null;
  return { ...next, origen, orden: normalizeOrder(next.orden, mode) };
};

export const addToken = (state: DocsSearchState, token: DocsToken): DocsSearchState =>
  withChange(state, { tokens: insertToken(state.tokens, token) });

export const removeTokenAt = (state: DocsSearchState, index: number): DocsSearchState =>
  withChange(state, { tokens: state.tokens.filter((_, i) => i !== index) });

export const setPublico = (state: DocsSearchState, publico: boolean): DocsSearchState =>
  withChange(state, { publico });

export const setOrden = (state: DocsSearchState, orden: DocsOrder): DocsSearchState =>
  withChange(state, { orden });

export const setPagina = (state: DocsSearchState, pagina: number): DocsSearchState => ({
  ...state,
  pagina: Math.max(1, pagina),
});

export const clearTokens = (state: DocsSearchState): DocsSearchState =>
  withChange(state, { tokens: [] });

const ORIGIN_PATHS: Record<DocsOrigin, string> = {
  proyecto: '/projects',
  requisito: '/requirements',
  // La ruta real de la tarea es /objectives/[id].
  tarea: '/objectives',
};

export function viewOf(state: DocsSearchState): {
  mode: 'inicio' | 'listado' | 'texto';
  sinProyecto: boolean;
  origin: { kind: DocsOrigin; id: number; href: string } | null;
} {
  const mode = modeOfTokens(state.tokens, state.publico);
  const sinProyecto = state.tokens.some((t) => t.kind === 'sinProyecto');
  let origin: { kind: DocsOrigin; id: number; href: string } | null = null;
  if (state.origen) {
    const token = state.tokens.find((t) => t.kind === state.origen);
    if (token && 'id' in token) {
      // El destino se arma con el id del token: nunca con una URL de la query.
      origin = {
        kind: state.origen,
        id: token.id,
        href: `${ORIGIN_PATHS[state.origen]}/${token.id}`,
      };
    }
  }
  return { mode, sinProyecto, origin };
}

type Filters = Pick<
  DocumentsFilters,
  | 'projectId'
  | 'clientId'
  | 'topic'
  | 'person'
  | 'requirementId'
  | 'taskId'
  | 'hasProject'
  | 'hasClient'
  | 'hasTopic'
  | 'visibility'
>;

const baseFilters = (state: DocsSearchState): Filters => {
  const ids = (kind: 'proyecto' | 'cliente'): number[] =>
    state.tokens.flatMap((t) => (t.kind === kind ? [t.id] : []));
  const projectId = ids('proyecto');
  const clientId = ids('cliente');
  const topic = state.tokens.flatMap((t) => (t.kind === 'tema' ? [t.value] : []));
  const person = state.tokens.flatMap((t) => (t.kind === 'persona' ? [t.sub] : []));
  const requirement = state.tokens.find((t) => t.kind === 'requisito');
  const task = state.tokens.find((t) => t.kind === 'tarea');
  const has = (kind: DocsToken['kind']) => state.tokens.some((t) => t.kind === kind);
  return {
    ...(projectId.length ? { projectId } : {}),
    ...(clientId.length ? { clientId } : {}),
    ...(topic.length ? { topic } : {}),
    ...(person.length ? { person } : {}),
    ...(requirement && 'id' in requirement ? { requirementId: requirement.id } : {}),
    ...(task && 'id' in task ? { taskId: task.id } : {}),
    ...(has('sinProyecto') ? { hasProject: false } : {}),
    ...(has('sinCliente') ? { hasClient: false } : {}),
    ...(has('sinTema') ? { hasTopic: false } : {}),
    ...(state.publico ? { visibility: 'public' as const } : {}),
  };
};

export const toListFilters = (state: DocsSearchState): DocumentsFilters => ({
  ...baseFilters(state),
  sort: state.orden === 'az' ? 'title' : '-updatedAt',
  limit: LIST_PAGE_SIZE,
  count: true,
});

export const toSearchQuery = (state: DocsSearchState): SearchDocumentsParams => ({
  ...baseFilters(state),
  q: state.tokens.flatMap((t) => (t.kind === 'texto' ? [t.value] : [])).join(' '),
  limit: TEXT_SEARCH_LIMIT,
});
