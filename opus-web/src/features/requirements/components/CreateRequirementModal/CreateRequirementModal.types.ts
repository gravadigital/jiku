import type { RequirementPriority } from '../../types/requirement.types';

export interface CreateRequirementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type RequirementType = 'Funcionalidad' | 'Mejora' | 'Incidencia' | 'Otro';

export interface PriorityOption {
  value: RequirementPriority;
  label: string;
  dotClass: string;
}

export interface TypeOption {
  value: RequirementType;
  label: string;
  description: string;
  badge: string;
  badgeClass: string;
}

export const PRIORITY_OPTIONS: PriorityOption[] = [
  { value: 'sin_prioridad', label: 'Sin prioridad', dotClass: 'dotNone' },
  { value: 'baja', label: 'Baja', dotClass: 'dotLow' },
  { value: 'media', label: 'Media', dotClass: 'dotMedium' },
  { value: 'alta', label: 'Alta', dotClass: 'dotHigh' },
  { value: 'urgente', label: 'Urgente', dotClass: 'dotUrgent' },
];

export const TYPE_OPTIONS: TypeOption[] = [
  {
    value: 'Funcionalidad',
    label: 'Funcionalidad',
    description: 'nueva función del sistema',
    badge: 'F',
    badgeClass: 'badgeTask',
  },
  {
    value: 'Mejora',
    label: 'Mejora',
    description: 'optimización de algo existente',
    badge: 'M',
    badgeClass: 'badgeStory',
  },
  {
    value: 'Incidencia',
    label: 'Incidencia',
    description: 'bug, error o comportamiento inesperado',
    badge: 'I',
    badgeClass: 'badgeBug',
  },
  {
    value: 'Otro',
    label: 'Otro',
    description: 'tarea operativa, documentación, gestión, etc.',
    badge: 'O',
    badgeClass: 'badgeEpic',
  },
];
