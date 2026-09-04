import { calculateDaysLeft } from '@/shared/utils/calculate-days-left';

export const OBJECTIVE_STATE_LABELS: Record<string, string> = {
  activo: 'Activo',
  backlog: 'Backlog',
  cancelado: 'Cancelado',
  en_revision: 'En revisión',
  finalizado: 'Finalizado',
};

// Los mapas de color por hex (los dos `*_COLORS` que había acá) se dieron de baja con la
// identidad Jiku: llevaban la paleta anterior —el verde, el rosa y el violeta que la tabla de
// migración del handoff descontinúa— y no tenían consumidores, sólo se re-exportaban desde el
// barrel. El color de estado hoy lo resuelve la familia del Badge del DS, que respeta los
// tintes del manual. Las ETIQUETAS se conservan: cambió el color, no el contenido.
export const OBJECTIVE_AREA_LABELS: Record<string, string> = {
  desarrollo: 'Desarrollo',
  diseño: 'Diseño',
  gestion: 'Gestión',
  investigacion: 'Investigación',
};

export const getStateLabel = (state: string): string => {
  return OBJECTIVE_STATE_LABELS[state] || state;
};

export const getAreaLabel = (area: string): string => {
  return OBJECTIVE_AREA_LABELS[area] || area;
};

const CLOSED_STATES = ['finalizado', 'cancelado'] as const;
type ClosedState = (typeof CLOSED_STATES)[number];

export const isOverdue = (state: string, estimatedFinishDate: Date | null | undefined): boolean => {
  if (CLOSED_STATES.includes(state as ClosedState)) return false;
  if (!estimatedFinishDate) return false;
  return calculateDaysLeft(new Date(estimatedFinishDate)) < 0;
};
