'use client';

import { useQuery } from '@tanstack/react-query';
import { getModules } from '../services/modulesApi';
import type { ModuleStatus } from '../types/module.types';

interface UseModulesOptions {
  enabled?: boolean;
}

export const useModules = ({ enabled = true }: UseModulesOptions = {}) => {
  return useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
    refetchInterval: 60_000,
    enabled,
  });
};

export interface ModuleInfo {
  status: ModuleStatus;
  sharing: boolean;
  isKnown: boolean;
}

/**
 * Estado de un módulo opcional. Mientras `GET /modules` carga o falla se comporta como
 * `not_installed` (P-3): no se muestra nada de documentación.
 */
export const useModule = (name: string): ModuleInfo => {
  const { data, isLoading, isError } = useModules();

  if (isLoading || isError || !data) {
    return { status: 'not_installed', sharing: false, isKnown: false };
  }

  const entry = data.find((m) => m.module === name);
  return {
    status: entry?.status ?? 'not_installed',
    sharing: entry?.features?.sharing ?? false,
    isKnown: true,
  };
};
