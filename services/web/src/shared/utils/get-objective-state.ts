export const getObjectiveState = (state: string): string => {
  const stateMap: { [key: string]: string } = {
    activo: 'Activo',
    backlog: 'Backlog',
    cancelado: 'Cancelado',
    en_revision: 'En revisión',
    finalizado: 'Finalizado',
  };
  return stateMap[state] || state;
};
