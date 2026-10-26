import type { DocsToken } from '../../utils/docsSearchParams';

const PREFIX: Partial<Record<DocsToken['kind'], string>> = {
  proyecto: 'Proyecto',
  cliente: 'Cliente',
  tema: 'Tema',
  persona: 'Persona',
  requisito: 'Requisito',
  tarea: 'Tarea',
};

const SIN_LABELS = {
  sinProyecto: 'Sin proyecto',
  sinCliente: 'Sin cliente',
  sinTema: 'Sin tema',
} as const;

/** Etiqueta completa del token (`"Proyecto {nombre}"`, `"“{texto}”"`, `"Sin proyecto"`). */
export function formatTokenLabel(token: DocsToken, name: string): string {
  if (token.kind === 'texto') return `“${token.value}”`;
  if (token.kind === 'sinProyecto' || token.kind === 'sinCliente' || token.kind === 'sinTema') {
    return SIN_LABELS[token.kind];
  }
  return `${PREFIX[token.kind]} ${name}`;
}
