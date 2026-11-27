import { useQuery } from '@tanstack/react-query';
import { modulesApi } from '../services/modulesApi';
import type { ModuleEntry, ModuleStatus } from '../types/docs.types';

interface UseModulesParams {
  enabled?: boolean;
}

export function useModules({ enabled = true }: UseModulesParams = {}) {
  return useQuery<ModuleEntry[]>({
    queryKey: ['modules'],
    queryFn: modulesApi.getAll,
    refetchInterval: 60_000,
    enabled,
  });
}

/**
 * Proyección de `useModules` para un módulo. Mientras carga o si falla se comporta como
 * `not_installed` con `isKnown: false`: evita el parpadeo de una sección que aparece y
 * desaparece. Quien necesite distinguir el fallo lee `isError` de `useModules`.
 */
export function useModule(name: string): { status: ModuleStatus; isKnown: boolean } {
  const { data, isError } = useModules();
  if (!data || isError) return { status: 'not_installed', isKnown: false };
  const entry = data.find((m) => m.module === name);
  return { status: entry?.status ?? 'not_installed', isKnown: true };
}
