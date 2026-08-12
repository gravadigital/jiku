import { calculateDaysLeft } from '@/shared/utils/calculate-days-left';

export const OBJECTIVE_STATE_LABELS: Record<string, string> = {
  activo: 'Activo',
  backlog: 'Backlog',
  cancelado: 'Cancelado',
  en_revision: 'En revisión',
  finalizado: 'Finalizado',
};

export const OBJECTIVE_AREA_LABELS: Record<string, string> = {
  desarrollo: 'Desarrollo',
  diseño: 'Diseño',
  gestion: 'Gestión',
  investigacion: 'Investigación',
};

export const OBJECTIVE_STATE_COLORS: Record<string, string> = {
  activo: '#22C55E',
  backlog: '#6B7280',
  cancelado: '#EF4444',
  en_revision: '#8B5CF6',
  finalizado: '#3B82F6',
};

export const OBJECTIVE_AREA_COLORS: Record<string, string> = {
  desarrollo: '#3B82F6',
  diseño: '#EC4899',
  gestion: '#6B7280',
  investigacion: '#F59E0B',
};

export const getStateLabel = (state: string): string => {
  return OBJECTIVE_STATE_LABELS[state] || state;
};

export const getAreaLabel = (area: string): string => {
  return OBJECTIVE_AREA_LABELS[area] || area;
};

export const getStateColor = (state: string): string => {
  return OBJECTIVE_STATE_COLORS[state] || '#6B7280';
};

export const getAreaColor = (area: string): string => {
  return OBJECTIVE_AREA_COLORS[area] || '#6B7280';
};

const CLOSED_STATES = ['finalizado', 'cancelado'] as const;
type ClosedState = (typeof CLOSED_STATES)[number];

export const isOverdue = (state: string, estimatedFinishDate: Date | null | undefined): boolean => {
  if (CLOSED_STATES.includes(state as ClosedState)) return false;
  if (!estimatedFinishDate) return false;
  return calculateDaysLeft(new Date(estimatedFinishDate)) < 0;
};
