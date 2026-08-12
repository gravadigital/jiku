import type { ProjectStatus, ProjectType } from '../types/project.types';

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
