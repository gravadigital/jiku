import { SIN_TOKENS, type DocsToken } from '../../utils/docsSearchParams';
import { formatTokenLabel } from './tokenLabels';
import type { DocsSearchSuggestions } from '../../types/docs.types';

export interface SuggestionOption {
  /** Posición en la lista plana (la que recorren las flechas). */
  index: number;
  label: string;
  secondary?: string;
  icon: 'search' | 'folder' | 'users' | 'user' | 'filter';
  token: DocsToken;
  /** Nombre que se guarda en `knownLabels` (sin prefijo). */
  name: string;
}

export interface SuggestionGroup {
  label: string;
  options: SuggestionOption[];
}

export interface SuggestionList {
  /** "Buscar «…»" y los "Sin …": van antes de los grupos y sin encabezado. */
  leading: SuggestionOption[];
  groups: SuggestionGroup[];
  flat: SuggestionOption[];
}

/** Minúsculas sin acentos. */
export const normalizeText = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

export function buildSuggestions(
  rawText: string,
  suggestions: DocsSearchSuggestions | undefined
): SuggestionList {
  const text = rawText.trim();
  const flat: SuggestionOption[] = [];
  const make = (option: Omit<SuggestionOption, 'index'>): SuggestionOption => {
    const built = { ...option, index: flat.length };
    flat.push(built);
    return built;
  };

  const leading: SuggestionOption[] = [
    make({
      label: `Buscar «${text}» en títulos y contenido`,
      icon: 'search',
      token: { kind: 'texto', value: text },
      name: text,
    }),
  ];

  const normalized = normalizeText(text);
  if (normalized.startsWith('sin')) {
    for (const token of SIN_TOKENS) {
      const label = formatTokenLabel(token, '');
      if (normalizeText(label).startsWith(normalized)) {
        leading.push(make({ label, icon: 'filter', token, name: label }));
      }
    }
  }

  const groups: SuggestionGroup[] = [];
  const addGroup = (label: string, options: SuggestionOption[]) => {
    if (options.length > 0) groups.push({ label, options });
  };

  addGroup(
    'Proyectos',
    (suggestions?.projects ?? []).map((p) =>
      make({
        label: p.name,
        secondary: p.clientName ?? undefined,
        icon: 'folder',
        token: { kind: 'proyecto', id: p.id },
        name: p.name,
      })
    )
  );
  addGroup(
    'Clientes',
    (suggestions?.clients ?? []).map((c) =>
      make({
        label: c.name,
        icon: 'users',
        token: { kind: 'cliente', id: c.id },
        name: c.name,
      })
    )
  );
  addGroup(
    'Personas',
    (suggestions?.persons ?? []).map((p) =>
      make({
        label: p.name,
        icon: 'user',
        token: { kind: 'persona', sub: p.userId },
        name: p.name,
      })
    )
  );
  addGroup(
    'Temas',
    (suggestions?.topics ?? []).map((t) =>
      make({
        label: t.topic,
        secondary: `${t.documents} ${t.documents === 1 ? 'documento' : 'documentos'}`,
        icon: 'filter',
        token: { kind: 'tema', value: t.topic },
        name: t.topic,
      })
    )
  );

  return { leading, groups, flat };
}
