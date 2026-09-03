import type { ProjectStatus, ProjectType } from '../types/project.types';
import type { BadgeFamily } from '@/shared/components/ui/Badge';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  activo: 'Activo',
  analisis: 'En análisis',
  cancelado: 'Cancelado',
  finalizado: 'Finalizado',
  inactivo: 'Inactivo',
};

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  comercial: 'Comercial',
  interno: 'Interno',
  investigacion: 'Investigación',
  propuesta: 'Propuesta',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  activo: '#22C55E',
  analisis: '#FFA500',
  cancelado: '#EF4444',
  finalizado: '#3B82F6',
  inactivo: '#6B7280',
};

export const getStatusLabel = (status: ProjectStatus): string => {
  return PROJECT_STATUS_LABELS[status] || status;
};

export const getTypeLabel = (type: ProjectType): string => {
  return PROJECT_TYPE_LABELS[type] || type;
};

export const getStatusColor = (status: ProjectStatus): string => {
  return PROJECT_STATUS_COLORS[status] || '#6B7280';
};

/**
 * Mapeo estado de proyecto -> familia de color del Badge del DS. Los estados de proyecto
 * (`activo`/`analisis`/`inactivo`/`finalizado`/`cancelado`) son un dominio distinto del de
 * tareas/objectives (que usa `STATE_TO_FAMILY` exportado por `Badge`), así que necesitan su
 * propia tabla — no se reutiliza `STATE_TO_FAMILY` con claves que no matchean.
 */
export const PROJECT_STATUS_TO_FAMILY: Record<ProjectStatus, BadgeFamily> = {
  activo: 'in-progress',
  analisis: 'analysis',
  finalizado: 'resolved',
  inactivo: 'neutral',
  cancelado: 'neutral',
};
