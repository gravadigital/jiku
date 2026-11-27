'use client';

import { usePersons } from '@/features/auth/hooks/usePersons';
import { useClient } from '@/features/clients/hooks/useClient';
import { useObjective } from '@/features/objectives/hooks/useObjective';
import { useProject } from '@/features/projects/hooks/useProject';
import { useRequirement } from '@/features/requirements/hooks/useRequirement';
import { tokenKey, type DocsToken } from '../../utils/docsSearchParams';

/**
 * Nombre de un token (sin el prefijo "Proyecto …"). Primero lo que ya se conoce (se eligió en
 * esta sesión); si no, lo que la web ya consulta. Mientras carga, o si el id no existe: `#id`.
 */
export function useTokenLabel(token: DocsToken, knownLabels: Record<string, string>): string {
  const known = knownLabels[tokenKey(token)];
  const resolve = !known;

  const project = useProject({
    id: token.kind === 'proyecto' ? token.id : 0,
    enabled: resolve && token.kind === 'proyecto',
  });
  const client = useClient({
    id: token.kind === 'cliente' ? token.id : 0,
    enabled: resolve && token.kind === 'cliente',
  });
  const persons = usePersons({ enabled: resolve && token.kind === 'persona' });
  const requirement = useRequirement(token.kind === 'requisito' ? token.id : 0, {
    enabled: resolve && token.kind === 'requisito',
  });
  const objective = useObjective({
    id: token.kind === 'tarea' ? token.id : 0,
    enabled: resolve && token.kind === 'tarea',
  });

  if (known) return known;
  switch (token.kind) {
    case 'proyecto':
      return project.data?.name ?? `#${token.id}`;
    case 'cliente':
      return client.data?.name ?? `#${token.id}`;
    case 'persona': {
      const person = persons.data?.find((p) => p.userId === token.sub);
      return person ? `${person.firstName} ${person.lastName}`.trim() : `#${token.sub}`;
    }
    case 'requisito':
      return requirement.data?.title ?? `#${token.id}`;
    case 'tarea':
      return objective.data?.title ?? `#${token.id}`;
    case 'tema':
    case 'texto':
      return token.value;
    default:
      return '';
  }
}
