export const REQUIREMENT_STATE_ITEMS = [
  { id: 'analisis', label: 'Análisis', dotColor: '#94a3b8' },
  { id: 'planificacion', label: 'Planificación', dotColor: '#8b5cf6' },
  { id: 'en_cola', label: 'En cola', dotColor: '#0ea5e9' },
  { id: 'desarrollo', label: 'Desarrollo', dotColor: '#22c55e' },
  { id: 'revision', label: 'Revisión', dotColor: '#f59e0b' },
  { id: 'resuelto', label: 'Resuelto', dotColor: '#2563eb' },
  { id: 'cancelado', label: 'Cancelado', dotColor: '#ef4444' },
] as const;

export const REQUIREMENT_PRIORITY_ITEMS = [
  { id: 'sin_prioridad', label: 'Sin prioridad', color: '#64748b' },
  { id: 'baja', label: 'Baja', color: '#1d4ed8' },
  { id: 'media', label: 'Media', color: '#b45309' },
  { id: 'alta', label: 'Alta', color: '#c2410c' },
  { id: 'urgente', label: 'Urgente', color: '#e11d48' },
] as const;
