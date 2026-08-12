export const getObjectiveTypeOfActivity = (state: string): string => {
  const stateMap: { [key: string]: string } = {
    area: 'Área',
    comment: 'Comentario',
    description: 'Descripción',
    estimatedFinishDate: 'Fecha de finalización estimada',
    priority: 'Prioridad',
    stageId: 'Etapa',
    state: 'Estado',
    title: 'Título',
  };
  return stateMap[state] || state;
};
