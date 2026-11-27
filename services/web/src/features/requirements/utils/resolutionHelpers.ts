import type { RequirementResolutionType } from '../types/requirement.types';

export const RESOLUTION_TYPE_LABELS: Record<RequirementResolutionType, string> = {
  error_interno: 'Error interno',
  fuera_de_alcance: 'Fuera de alcance',
  error_externo: 'Error externo',
  discutible: 'Discutible',
  otro: 'Otro',
};

export const RESOLUTION_TYPE_OPTIONS: { label: string; value: RequirementResolutionType }[] = [
  { label: 'Error interno', value: 'error_interno' },
  { label: 'Fuera de alcance', value: 'fuera_de_alcance' },
  { label: 'Error externo', value: 'error_externo' },
  { label: 'Discutible', value: 'discutible' },
  { label: 'Otro', value: 'otro' },
];
