import type { RequirementPriority, RequirementType } from '../types/requirement.types';

export const TYPE_LABELS: Record<Exclude<RequirementType, null>, string> = {
  funcionalidad: 'Funcionalidad',
  mejora: 'Mejora',
  incidencia: 'Incidencia',
  otro: 'Otro',
};

export function getTypeLabel(type: RequirementType | null | undefined): string {
  if (!type) return 'Sin tipo';
  return TYPE_LABELS[type] ?? 'Sin tipo';
}

export const PRIORITY_LABELS: Record<RequirementPriority, string> = {
  sin_prioridad: 'Sin prioridad',
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

const ACTIVITY_FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  description: 'Descripción',
  type: 'Tipo',
  priority: 'Prioridad',
  estimatedFinishDate: 'Fecha estimada',
  project: 'Proyecto',
  tag: 'Etiqueta',
};

export function getActivityFieldLabel(typeOfActivity: string): string {
  return ACTIVITY_FIELD_LABELS[typeOfActivity] ?? typeOfActivity;
}

export function getActivityValueLabel(typeOfActivity: string, value: string): string {
  if (typeOfActivity === 'type') return getTypeLabel(value as RequirementType);
  if (typeOfActivity === 'priority') return PRIORITY_LABELS[value as RequirementPriority] ?? value;
  return value;
}
