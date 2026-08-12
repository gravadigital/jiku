export const getProjectStatus = (state: string): string => {
  const statusMap: { [key: string]: string } = {
    activo: 'Activo',
    analisis: 'Análisis',
    cancelado: 'Cancelado',
    finalizado: 'Finalizado',
    inactivo: 'Inactivo',
  };
  return statusMap[state] || state;
};
